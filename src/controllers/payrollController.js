const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const Department = require('../models/Department');
const Notification = require('../models/Notification');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { logAudit } = require('../services/auditService');
const { generatePayslipPDF } = require('../services/pdfService');
const { sendRealtimeNotification } = require('../services/socketService');

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * @desc    Generate Payroll for all active employees (Batch)
 * @route   POST /api/payroll/generate
 * @access  Private (Super Admin, HR Manager)
 */
const generateMonthlyPayroll = async (req, res, next) => {
  try {
    const { month, year, departmentId } = req.body;

    if (!month || !year) {
      return errorResponse(res, 'Month (1-12) and Year are required', 400);
    }

    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    const payPeriod = `${monthNames[monthNum - 1]} ${yearNum}`;

    const query = { status: 'Active' };
    if (departmentId) {
      query.department = departmentId;
    }

    const employees = await Employee.find(query);
    if (!employees || employees.length === 0) {
      return errorResponse(res, 'No active employees found to generate payroll for', 400);
    }

    const createdPayrolls = [];
    const skippedPayrolls = [];

    for (const emp of employees) {
      // Check if already generated
      const existing = await Payroll.findOne({
        employee: emp._id,
        month: monthNum,
        year: yearNum,
      });

      if (existing) {
        skippedPayrolls.push(emp.fullName);
        continue;
      }

      // Enterprise Salary structure calculation
      const monthlyGross = Math.round(emp.salary / 12);
      const basicSalary = Math.round(monthlyGross * 0.50); // 50%
      const hra = Math.round(monthlyGross * 0.20); // 20%
      const allowances = Math.round(monthlyGross * 0.20); // 20%
      const bonus = 0;
      const grossEarnings = basicSalary + hra + allowances + bonus;

      const taxDeduction = Math.round(grossEarnings * 0.10); // 10%
      const pfDeduction = Math.round(basicSalary * 0.12); // 12% of basic
      const otherDeductions = 0;
      const totalDeductions = taxDeduction + pfDeduction + otherDeductions;
      const netSalary = grossEarnings - totalDeductions;

      const payroll = await Payroll.create({
        employee: emp._id,
        month: monthNum,
        year: yearNum,
        payPeriod,
        basicSalary,
        hra,
        allowances,
        bonus,
        grossEarnings,
        taxDeduction,
        pfDeduction,
        otherDeductions,
        totalDeductions,
        netSalary,
        paymentStatus: 'Pending',
        paymentMethod: 'Bank Transfer',
      });

      createdPayrolls.push(payroll);

      // Create notification for employee
      if (emp.user) {
        const notif = await Notification.create({
          recipient: emp.user,
          title: 'Payslip Generated',
          message: `Your payslip for ${payPeriod} has been generated (Net: $${netSalary.toLocaleString()}).`,
          type: 'payroll',
          link: '/payroll',
        });
        sendRealtimeNotification(notif);
      }
    }

    await logAudit({
      req,
      action: 'GENERATE_PAYROLL_BATCH',
      module: 'Payroll',
      details: {
        payPeriod,
        generatedCount: createdPayrolls.length,
        skippedCount: skippedPayrolls.length,
      },
    });

    return successResponse(
      res,
      {
        generatedCount: createdPayrolls.length,
        skippedCount: skippedPayrolls.length,
        payPeriod,
      },
      `Generated payroll for ${createdPayrolls.length} employee(s). ${skippedPayrolls.length} were already generated.`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Payrolls with filtering and pagination
 * @route   GET /api/payroll
 * @access  Private
 */
const getPayrolls = async (req, res, next) => {
  try {
    const {
      month,
      year,
      department,
      status,
      employeeId,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};

    // Role filtering: Employee can only see own payroll
    if (req.user.role === 'Employee') {
      const empId = req.user.employeeProfile?._id || req.user.employeeProfile;
      query.employee = empId;
    } else if (employeeId) {
      query.employee = employeeId;
    }

    if (month) query.month = parseInt(month, 10);
    if (year) query.year = parseInt(year, 10);
    if (status) query.paymentStatus = status;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    let payrollsQuery = Payroll.find(query)
      .populate({
        path: 'employee',
        select: 'employeeId firstName lastName fullName email designation department bankDetails salary',
        populate: { path: 'department', select: 'name code' },
      })
      .sort({ year: -1, month: -1, createdAt: -1 });

    const total = await Payroll.countDocuments(query);
    const payrolls = await payrollsQuery.skip(skip).limit(limitNum);

    // If department filter is supplied, filter populated
    const filtered = department
      ? payrolls.filter(
          (p) =>
            p.employee &&
            p.employee.department &&
            p.employee.department._id.toString() === department
        )
      : payrolls;

    return successResponse(res, filtered, 'Payroll records retrieved', 200, {
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
 * @desc    Get single payroll record
 * @route   GET /api/payroll/:id
 * @access  Private
 */
const getPayrollById = async (req, res, next) => {
  try {
    const payroll = await Payroll.findById(req.params.id).populate({
      path: 'employee',
      populate: { path: 'department', select: 'name code' },
    });

    if (!payroll) {
      return errorResponse(res, 'Payroll record not found', 404);
    }

    return successResponse(res, payroll, 'Payroll details retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Payroll Status & Deductions / Bonus
 * @route   PUT /api/payroll/:id
 * @access  Private (Super Admin, HR Manager)
 */
const updatePayroll = async (req, res, next) => {
  try {
    const payroll = await Payroll.findById(req.params.id).populate('employee');
    if (!payroll) {
      return errorResponse(res, 'Payroll record not found', 404);
    }

    const {
      bonus,
      otherDeductions,
      taxDeduction,
      paymentStatus,
      paymentMethod,
      notes,
    } = req.body;

    if (bonus !== undefined) payroll.bonus = bonus;
    if (otherDeductions !== undefined) payroll.otherDeductions = otherDeductions;
    if (taxDeduction !== undefined) payroll.taxDeduction = taxDeduction;
    if (paymentMethod !== undefined) payroll.paymentMethod = paymentMethod;

    // Recalculate totals
    payroll.grossEarnings =
      payroll.basicSalary + payroll.hra + payroll.allowances + (payroll.bonus || 0);
    payroll.totalDeductions =
      (payroll.taxDeduction || 0) +
      (payroll.pfDeduction || 0) +
      (payroll.otherDeductions || 0);
    payroll.netSalary = payroll.grossEarnings - payroll.totalDeductions;

    if (paymentStatus) {
      payroll.paymentStatus = paymentStatus;
      if (paymentStatus === 'Paid' && !payroll.paymentDate) {
        payroll.paymentDate = new Date();
      }
    }
    if (notes !== undefined) payroll.notes = notes;

    await payroll.save();

    await logAudit({
      req,
      action: 'UPDATE_PAYROLL',
      module: 'Payroll',
      details: {
        payrollId: payroll._id,
        employee: payroll.employee?.fullName,
        paymentStatus: payroll.paymentStatus,
      },
    });

    const updated = await Payroll.findById(payroll._id).populate({
      path: 'employee',
      populate: { path: 'department', select: 'name code' },
    });

    return successResponse(res, updated, 'Payroll record updated');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Download Salary Slip as PDF
 * @route   GET /api/payroll/:id/download-pdf
 * @access  Private
 */
const downloadPayslipPDF = async (req, res, next) => {
  try {
    const payroll = await Payroll.findById(req.params.id).populate({
      path: 'employee',
      populate: { path: 'department', select: 'name code' },
    });

    if (!payroll) {
      return errorResponse(res, 'Payroll record not found', 404);
    }

    const employee = payroll.employee;
    const department = employee?.department;

    const safeName = (employee.fullName || 'Employee').replace(/\s+/g, '_');
    const safePeriod = payroll.payPeriod.replace(/\s+/g, '_');
    const filename = `Payslip_${safeName}_${safePeriod}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const pdfDoc = generatePayslipPDF(payroll, employee, department);
    pdfDoc.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Payroll Summary Metrics
 * @route   GET /api/payroll/summary
 * @access  Private (Super Admin, HR Manager)
 */
const getPayrollSummary = async (req, res, next) => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const payrolls = await Payroll.find({ year: currentYear });

    const totalDisbursed = payrolls
      .filter((p) => p.paymentStatus === 'Paid')
      .reduce((sum, p) => sum + p.netSalary, 0);

    const pendingDisbursed = payrolls
      .filter((p) => p.paymentStatus !== 'Paid')
      .reduce((sum, p) => sum + p.netSalary, 0);

    const totalTax = payrolls.reduce((sum, p) => sum + (p.taxDeduction || 0), 0);

    // Group by month
    const monthlyData = [];
    for (let m = 1; m <= 12; m++) {
      const monthPayrolls = payrolls.filter((p) => p.month === m);
      const totalGross = monthPayrolls.reduce((sum, p) => sum + p.grossEarnings, 0);
      const totalNet = monthPayrolls.reduce((sum, p) => sum + p.netSalary, 0);
      monthlyData.push({
        month: monthNames[m - 1].substring(0, 3),
        grossEarnings: totalGross,
        netSalary: totalNet,
        count: monthPayrolls.length,
      });
    }

    return successResponse(
      res,
      {
        totalDisbursed,
        pendingDisbursed,
        totalTax,
        monthlyData,
      },
      'Payroll summary retrieved'
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateMonthlyPayroll,
  getPayrolls,
  getPayrollById,
  updatePayroll,
  downloadPayslipPDF,
  getPayrollSummary,
};
