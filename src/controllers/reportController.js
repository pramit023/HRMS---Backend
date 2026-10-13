const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const Department = require('../models/Department');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { exportToExcelBuffer } = require('../utils/exportHelper');

/**
 * @desc    Export or get Attendance Report
 * @route   GET /api/reports/attendance
 * @access  Private (Super Admin, HR Manager)
 */
const getAttendanceReport = async (req, res, next) => {
  try {
    const { startDate, endDate, departmentId, format } = req.query;

    const query = {};
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const records = await Attendance.find(query)
      .populate({
        path: 'employee',
        select: 'employeeId firstName lastName fullName department designation',
        populate: { path: 'department', select: 'name code' },
      })
      .sort({ date: -1 });

    const filtered = departmentId
      ? records.filter((r) => r.employee?.department?._id.toString() === departmentId)
      : records;

    const formattedData = filtered.map((r) => ({
      'Employee ID': r.employee?.employeeId || 'N/A',
      'Employee Name': r.employee?.fullName || 'N/A',
      Department: r.employee?.department?.name || 'N/A',
      Designation: r.employee?.designation || 'N/A',
      Date: new Date(r.date).toLocaleDateString(),
      'Check In': r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : 'N/A',
      'Check Out': r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : 'N/A',
      'Working Hours': r.workingHours || 0,
      Status: r.status,
      Notes: r.notes || '',
    }));

    if (format === 'excel') {
      const buffer = exportToExcelBuffer(formattedData, 'Attendance_Report');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Attendance_Report.xlsx"');
      return res.send(buffer);
    }

    return successResponse(res, formattedData, 'Attendance report retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export or get Leave Report
 * @route   GET /api/reports/leave
 * @access  Private (Super Admin, HR Manager)
 */
const getLeaveReport = async (req, res, next) => {
  try {
    const { status, leaveType, format } = req.query;
    const query = {};
    if (status) query.status = status;
    if (leaveType) query.leaveType = leaveType;

    const leaves = await LeaveRequest.find(query)
      .populate({
        path: 'employee',
        select: 'employeeId firstName lastName fullName department designation',
        populate: { path: 'department', select: 'name code' },
      })
      .populate('reviewedBy', 'name role')
      .sort({ createdAt: -1 });

    const formattedData = leaves.map((l) => ({
      'Employee ID': l.employee?.employeeId || 'N/A',
      'Employee Name': l.employee?.fullName || 'N/A',
      Department: l.employee?.department?.name || 'N/A',
      'Leave Type': l.leaveType,
      'Start Date': new Date(l.startDate).toLocaleDateString(),
      'End Date': new Date(l.endDate).toLocaleDateString(),
      'Total Days': l.days,
      Status: l.status,
      Reason: l.reason,
      'Reviewed By': l.reviewedBy?.name || 'N/A',
      'Applied Date': new Date(l.createdAt).toLocaleDateString(),
    }));

    if (format === 'excel') {
      const buffer = exportToExcelBuffer(formattedData, 'Leave_Report');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Leave_Report.xlsx"');
      return res.send(buffer);
    }

    return successResponse(res, formattedData, 'Leave report retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export or get Payroll Report
 * @route   GET /api/reports/payroll
 * @access  Private (Super Admin, HR Manager)
 */
const getPayrollReport = async (req, res, next) => {
  try {
    const { year, month, format } = req.query;
    const query = {};
    if (year) query.year = parseInt(year, 10);
    if (month) query.month = parseInt(month, 10);

    const payrolls = await Payroll.find(query)
      .populate({
        path: 'employee',
        select: 'employeeId firstName lastName fullName department designation bankDetails',
        populate: { path: 'department', select: 'name code' },
      })
      .sort({ year: -1, month: -1 });

    const formattedData = payrolls.map((p) => ({
      'Pay Period': p.payPeriod,
      'Employee ID': p.employee?.employeeId || 'N/A',
      'Employee Name': p.employee?.fullName || 'N/A',
      Department: p.employee?.department?.name || 'N/A',
      'Basic Salary': `$${p.basicSalary.toLocaleString()}`,
      HRA: `$${p.hra.toLocaleString()}`,
      Allowances: `$${p.allowances.toLocaleString()}`,
      Bonus: `$${p.bonus.toLocaleString()}`,
      'Gross Earnings': `$${p.grossEarnings.toLocaleString()}`,
      'Tax Deduction': `$${p.taxDeduction.toLocaleString()}`,
      'PF Deduction': `$${p.pfDeduction.toLocaleString()}`,
      'Total Deductions': `$${p.totalDeductions.toLocaleString()}`,
      'Net Salary': `$${p.netSalary.toLocaleString()}`,
      'Payment Status': p.paymentStatus,
      'Payment Method': p.paymentMethod,
    }));

    if (format === 'excel') {
      const buffer = exportToExcelBuffer(formattedData, 'Payroll_Report');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Payroll_Report.xlsx"');
      return res.send(buffer);
    }

    return successResponse(res, formattedData, 'Payroll report retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export or get Employee Directory Report
 * @route   GET /api/reports/employee
 * @access  Private (Super Admin, HR Manager)
 */
const getEmployeeReport = async (req, res, next) => {
  try {
    const { format } = req.query;
    const employees = await Employee.find()
      .populate('department', 'name code')
      .sort({ employeeId: 1 });

    const formattedData = employees.map((e) => ({
      'Employee ID': e.employeeId,
      'Full Name': e.fullName,
      Email: e.email,
      Phone: e.phone,
      Gender: e.gender,
      Department: e.department?.name || 'N/A',
      Designation: e.designation,
      Status: e.status,
      'Joining Date': new Date(e.joiningDate).toLocaleDateString(),
      'Annual Salary': `$${e.salary.toLocaleString()}`,
      'Casual Leave Bal': e.leaveBalance?.casualLeave || 0,
      'Sick Leave Bal': e.leaveBalance?.sickLeave || 0,
      'Earned Leave Bal': e.leaveBalance?.earnedLeave || 0,
    }));

    if (format === 'excel') {
      const buffer = exportToExcelBuffer(formattedData, 'Employee_Roster');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Employee_Roster.xlsx"');
      return res.send(buffer);
    }

    return successResponse(res, formattedData, 'Employee report retrieved');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAttendanceReport,
  getLeaveReport,
  getPayrollReport,
  getEmployeeReport,
};
