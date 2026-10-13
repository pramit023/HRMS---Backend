const Department = require('../models/Department');
const Employee = require('../models/Employee');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { logAudit } = require('../services/auditService');

/**
 * @desc    Get all departments with employee counts
 * @route   GET /api/departments
 * @access  Private
 */
const getDepartments = async (req, res, next) => {
  try {
    const departments = await Department.find()
      .populate('head', 'firstName lastName fullName email designation profilePhoto')
      .populate('employeeCount')
      .sort({ name: 1 });

    return successResponse(res, departments, 'Departments retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single department with its employees
 * @route   GET /api/departments/:id
 * @access  Private
 */
const getDepartmentById = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('head', 'firstName lastName fullName email designation profilePhoto');

    if (!department) {
      return errorResponse(res, 'Department not found', 404);
    }

    const employees = await Employee.find({ department: department._id })
      .select('employeeId firstName lastName fullName email designation status profilePhoto salary joiningDate');

    return successResponse(
      res,
      { department, employees },
      'Department and employee roster retrieved'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new department
 * @route   POST /api/departments
 * @access  Private (Super Admin, HR Manager)
 */
const createDepartment = async (req, res, next) => {
  try {
    const { name, code, description, head, budget, location } = req.body;

    const existing = await Department.findOne({
      $or: [{ name: { $regex: new RegExp(`^${name}$`, 'i') } }, { code: code.toUpperCase() }],
    });

    if (existing) {
      return errorResponse(res, 'Department with this name or code already exists', 400);
    }

    const department = await Department.create({
      name,
      code: code.toUpperCase(),
      description,
      head: head || null,
      budget: budget || 0,
      location: location || 'Headquarters',
    });

    await logAudit({
      req,
      action: 'CREATE_DEPARTMENT',
      module: 'Department',
      details: { name: department.name, code: department.code },
    });

    return successResponse(res, department, 'Department created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update department
 * @route   PUT /api/departments/:id
 * @access  Private (Super Admin, HR Manager)
 */
const updateDepartment = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return errorResponse(res, 'Department not found', 404);
    }

    const { name, code, description, head, budget, location, isActive } = req.body;

    if (name) department.name = name;
    if (code) department.code = code.toUpperCase();
    if (description !== undefined) department.description = description;
    if (head !== undefined) department.head = head || null;
    if (budget !== undefined) department.budget = budget;
    if (location !== undefined) department.location = location;
    if (isActive !== undefined) department.isActive = isActive;

    await department.save();

    await logAudit({
      req,
      action: 'UPDATE_DEPARTMENT',
      module: 'Department',
      details: { name: department.name, code: department.code },
    });

    return successResponse(res, department, 'Department updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete department
 * @route   DELETE /api/departments/:id
 * @access  Private (Super Admin)
 */
const deleteDepartment = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return errorResponse(res, 'Department not found', 404);
    }

    // Check if any employees belong to this department
    const employeeCount = await Employee.countDocuments({ department: department._id });
    if (employeeCount > 0) {
      return errorResponse(
        res,
        `Cannot delete department because it still has ${employeeCount} active employee(s) assigned. Reassign them first.`,
        400
      );
    }

    await Department.findByIdAndDelete(req.params.id);

    await logAudit({
      req,
      action: 'DELETE_DEPARTMENT',
      module: 'Department',
      details: { name: department.name, code: department.code },
    });

    return successResponse(res, null, 'Department deleted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Department Statistics (employee distribution, budgets)
 * @route   GET /api/departments/stats
 * @access  Private
 */
const getDepartmentStats = async (req, res, next) => {
  try {
    const departments = await Department.find();
    const stats = await Promise.all(
      departments.map(async (dept) => {
        const empCount = await Employee.countDocuments({ department: dept._id });
        const employees = await Employee.find({ department: dept._id }).select('salary status');
        const activeCount = employees.filter((e) => e.status === 'Active').length;
        const totalSalary = employees.reduce((acc, curr) => acc + (curr.salary || 0), 0);

        return {
          _id: dept._id,
          name: dept.name,
          code: dept.code,
          budget: dept.budget,
          location: dept.location,
          totalEmployees: empCount,
          activeEmployees: activeCount,
          totalPayrollExpense: totalSalary,
        };
      })
    );

    return successResponse(res, stats, 'Department statistics retrieved');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentStats,
};
