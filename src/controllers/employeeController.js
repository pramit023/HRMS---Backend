const Employee = require('../models/Employee');
const User = require('../models/User');
const Department = require('../models/Department');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const Payroll = require('../models/Payroll');
const PerformanceReview = require('../models/PerformanceReview');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { logAudit } = require('../services/auditService');
const { generateNextEmployeeId } = require('../utils/idGenerator');
const { generateTemporaryPassword } = require('../utils/passwordGenerator');
const { sendEmployeeWelcomeEmail } = require('../services/emailService');

/**
 * @desc    Get all employees with search, filter, and pagination
 * @route   GET /api/employees
 * @access  Private (Super Admin, HR Manager, Employee)
 */
const getAllEmployees = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      department = '',
      status = '',
      designation = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = {};

    // Search query for fullName, email, phone, employeeId
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
      ];
    }

    if (department) {
      query.department = department;
    }

    if (status) {
      query.status = status;
    }

    if (designation) {
      query.designation = { $regex: designation, $options: 'i' };
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const total = await Employee.countDocuments(query);
    const employees = await Employee.find(query)
      .populate('department', 'name code')
      .populate('user', 'email role isActive lastLogin')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    return successResponse(res, employees, 'Employees retrieved successfully', 200, {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single employee details by ID
 * @route   GET /api/employees/:id
 * @access  Private
 */
const getEmployeeById = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('department', 'name code budget location head')
      .populate('user', 'email role isActive lastLogin');

    if (!employee) {
      return errorResponse(res, 'Employee not found', 404);
    }

    return successResponse(res, employee, 'Employee details retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new employee (and optional user account)
 * @route   POST /api/employees
 * @access  Private (Super Admin, HR Manager)
 */
const createEmployee = async (req, res, next) => {
  try {
    const {
      employeeId,
      firstName,
      lastName,
      email,
      phone,
      address,
      gender,
      dateOfBirth,
      department,
      designation,
      joiningDate,
      salary,
      role = 'Employee',
      password,
      emergencyContact,
      bankDetails,
    } = req.body;

    // Auto-generate sequential Employee ID if not explicitly provided
    let finalEmployeeId = employeeId;
    if (!finalEmployeeId || finalEmployeeId.trim() === '' || finalEmployeeId.toLowerCase().includes('auto')) {
      finalEmployeeId = await generateNextEmployeeId();
    } else {
      finalEmployeeId = finalEmployeeId.trim().toUpperCase();
    }

    // Auto-generate secure temporary password if not provided
    const tempPassword = password && password.trim() ? password.trim() : generateTemporaryPassword();

    // Check if employeeId or email already exists
    const existingEmp = await Employee.findOne({
      $or: [{ employeeId: finalEmployeeId }, { email: email.toLowerCase() }],
    });

    if (existingEmp) {
      return errorResponse(
        res,
        `Employee ID [${finalEmployeeId}] or Email [${email}] already exists. Please choose unique values.`,
        400
      );
    }

    // Auto-resolve Department if empty or 'auto'
    let resolvedDepartment = department;
    if (!resolvedDepartment || resolvedDepartment === 'auto') {
      let firstDept = await Department.findOne();
      if (!firstDept) {
        firstDept = await Department.create({
          name: 'General Operations',
          code: 'GEN',
          description: 'Default organization operational department',
          budget: 100000,
          location: 'Headquarters',
        });
      }
      resolvedDepartment = firstDept._id;
    }

    const resolvedSalary = (salary !== undefined && salary !== null && salary !== '') ? Number(salary) : 50000;
    const resolvedDesignation = (designation && designation.trim()) ? designation.trim() : 'Team Member';
    const resolvedDob = dateOfBirth ? new Date(dateOfBirth) : new Date('1995-01-01');

    // Create Employee record
    const newEmployee = new Employee({
      employeeId: finalEmployeeId,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      email: email.toLowerCase(),
      phone: phone || '+1 (555) 000-0000',
      address: address || {},
      gender: gender || 'Male',
      dateOfBirth: resolvedDob,
      department: resolvedDepartment,
      designation: resolvedDesignation,
      joiningDate: joiningDate || new Date(),
      salary: resolvedSalary,
      emergencyContact: emergencyContact || {},
      bankDetails: bankDetails || {},
    });

    await newEmployee.save();

    // Create or link User account with temporary password & mustChangePassword flag
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = await User.create({
        name: `${firstName} ${lastName}`.trim(),
        email: email.toLowerCase(),
        password: tempPassword,
        role: role,
        employeeProfile: newEmployee._id,
        mustChangePassword: true,
        isTemporaryPassword: true,
      });
    } else {
      user.employeeProfile = newEmployee._id;
      user.password = tempPassword;
      user.mustChangePassword = true;
      user.isTemporaryPassword = true;
      await user.save();
    }

    newEmployee.user = user._id;
    await newEmployee.save();

    // Send Onboarding Credentials Email via Nodemailer
    const loginUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/login`;
    await sendEmployeeWelcomeEmail({
      to: email.toLowerCase(),
      employeeName: newEmployee.fullName,
      employeeId: finalEmployeeId,
      tempPassword,
      loginUrl,
    });

    await logAudit({
      req,
      action: 'CREATE_EMPLOYEE',
      module: 'Employee',
      details: {
        employeeId: newEmployee.employeeId,
        name: newEmployee.fullName,
        department: resolvedDepartment,
        mustChangePassword: true,
      },
    });

    const populatedEmployee = await Employee.findById(newEmployee._id)
      .populate('department', 'name code')
      .populate('user', 'email role isActive mustChangePassword isTemporaryPassword');

    return successResponse(
      res,
      {
        employee: populatedEmployee,
        temporaryPassword: tempPassword,
        mustChangePassword: true,
      },
      'Employee onboarded successfully. Credentials dispatched via email.',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update employee
 * @route   PUT /api/employees/:id
 * @access  Private (Super Admin, HR Manager)
 */
const updateEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return errorResponse(res, 'Employee not found', 404);
    }

    const {
      firstName,
      lastName,
      phone,
      address,
      gender,
      dateOfBirth,
      department,
      designation,
      joiningDate,
      salary,
      status,
      emergencyContact,
      bankDetails,
      leaveBalance,
      role,
    } = req.body;

    if (firstName) employee.firstName = firstName;
    if (lastName) employee.lastName = lastName;
    if (firstName || lastName) {
      employee.fullName = `${employee.firstName} ${employee.lastName}`.trim();
    }
    if (phone) employee.phone = phone;
    if (address) employee.address = { ...employee.address, ...address };
    if (gender) employee.gender = gender;
    if (dateOfBirth) employee.dateOfBirth = dateOfBirth;
    if (department) employee.department = department;
    if (designation) employee.designation = designation;
    if (joiningDate) employee.joiningDate = joiningDate;
    if (salary !== undefined) employee.salary = salary;
    if (status) employee.status = status;
    if (emergencyContact) employee.emergencyContact = { ...employee.emergencyContact, ...emergencyContact };
    if (bankDetails) employee.bankDetails = { ...employee.bankDetails, ...bankDetails };
    if (leaveBalance) employee.leaveBalance = { ...employee.leaveBalance, ...leaveBalance };

    await employee.save();

    // If user role was changed
    if (role && employee.user) {
      await User.findByIdAndUpdate(employee.user, {
        role,
        name: employee.fullName,
      });
    }

    // If password reset/update was provided
    if (req.body.password && req.body.password.trim() && employee.user) {
      const userToUpdate = await User.findById(employee.user);
      if (userToUpdate) {
        userToUpdate.password = req.body.password.trim();
        userToUpdate.mustChangePassword = true;
        await userToUpdate.save();
      }
    }

    await logAudit({
      req,
      action: 'UPDATE_EMPLOYEE',
      module: 'Employee',
      details: { employeeId: employee.employeeId, changes: req.body },
    });

    const updated = await Employee.findById(employee._id)
      .populate('department', 'name code')
      .populate('user', 'email role isActive');

    return successResponse(res, updated, 'Employee updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Permanently delete employee and all associated records
 * @route   DELETE /api/employees/:id
 * @access  Private (Super Admin, HR Manager)
 */
const deleteEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return errorResponse(res, 'Employee not found', 404);
    }

    // 1. Delete linked User login account
    if (employee.user) {
      await User.findByIdAndDelete(employee.user);
    } else {
      await User.deleteOne({ email: employee.email });
    }

    // 2. Cascade delete related records
    await Promise.all([
      Attendance.deleteMany({ employee: employee._id }),
      LeaveRequest.deleteMany({ employee: employee._id }),
      Payroll.deleteMany({ employee: employee._id }),
      PerformanceReview.deleteMany({ employee: employee._id }),
      Department.updateMany({ head: employee._id }, { $unset: { head: 1 } }),
    ]);

    // 3. Delete Employee record itself
    await Employee.findByIdAndDelete(req.params.id);

    await logAudit({
      req,
      action: 'DELETE_EMPLOYEE',
      module: 'Employee',
      details: {
        employeeId: employee.employeeId,
        name: employee.fullName,
        email: employee.email,
      },
    });

    return successResponse(res, null, 'Employee permanently deleted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload profile photo
 * @route   POST /api/employees/:id/photo
 * @access  Private
 */
const uploadPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'Please upload an image file', 400);
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return errorResponse(res, 'Employee not found', 404);
    }

    const photoUrl = `/uploads/${req.file.filename}`;
    employee.profilePhoto = photoUrl;
    await employee.save();

    if (employee.user) {
      await User.findByIdAndUpdate(employee.user, { avatar: photoUrl });
    }

    return successResponse(res, { photoUrl }, 'Profile photo uploaded successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload Document to Employee
 * @route   POST /api/employees/:id/documents
 * @access  Private (Super Admin, HR Manager)
 */
const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'Please upload a document file', 400);
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return errorResponse(res, 'Employee not found', 404);
    }

    const documentName = req.body.name || req.file.originalname;
    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype.includes('pdf') ? 'pdf' : 'document';

    employee.documents.push({
      name: documentName,
      fileUrl,
      fileType,
      uploadedAt: new Date(),
    });

    await employee.save();

    await logAudit({
      req,
      action: 'UPLOAD_DOCUMENT',
      module: 'Employee',
      details: { employeeId: employee.employeeId, documentName },
    });

    return successResponse(res, employee.documents, 'Document uploaded successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete Document from Employee
 * @route   DELETE /api/employees/:id/documents/:docId
 * @access  Private (Super Admin, HR Manager)
 */
const deleteDocument = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return errorResponse(res, 'Employee not found', 404);
    }

    employee.documents = employee.documents.filter(
      (doc) => doc._id.toString() !== req.params.docId
    );
    await employee.save();

    return successResponse(res, employee.documents, 'Document removed successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  uploadPhoto,
  uploadDocument,
  deleteDocument,
};
