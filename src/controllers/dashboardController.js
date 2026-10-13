const Employee = require('../models/Employee');
const Department = require('../models/Department');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const Payroll = require('../models/Payroll');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// Normalize date to start of day
const getStartOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getEndOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * @desc    Get Super Admin Dashboard Data
 * @route   GET /api/dashboard/super-admin
 * @access  Private (Super Admin)
 */
const getSuperAdminDashboard = async (req, res, next) => {
  try {
    const todayStart = getStartOfDay();
    const todayEnd = getEndOfDay();

    // 1. Total Employees & Departments
    const totalEmployees = await Employee.countDocuments({ status: { $ne: 'Terminated' } });
    const activeEmployees = await Employee.countDocuments({ status: 'Active' });
    const totalDepartments = await Department.countDocuments({ isActive: true });

    // 2. Attendance & Leaves Today
    const presentToday = await Attendance.countDocuments({
      date: { $gte: todayStart, $lte: todayEnd },
      status: { $in: ['Present', 'Late'] },
    });

    const onLeaveToday = await LeaveRequest.countDocuments({
      status: 'Approved',
      startDate: { $lte: todayEnd },
      endDate: { $gte: todayStart },
    });

    // 3. Employee Growth & Monthly Hiring Statistics (Past 6 Months)
    const months = [];
    const hiringStats = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthLabel = d.toLocaleString('default', { month: 'short' });

      const hiresInMonth = await Employee.countDocuments({
        joiningDate: { $gte: d, $lte: mEnd },
      });

      const totalCumulative = await Employee.countDocuments({
        joiningDate: { $lte: mEnd },
        status: { $ne: 'Terminated' },
      });

      hiringStats.push({
        month: monthLabel,
        hires: hiresInMonth,
        totalEmployees: totalCumulative,
      });
    }

    // 4. Payroll Summary (Current year / recent month)
    const currentYear = now.getFullYear();
    const recentPayrolls = await Payroll.find({ year: currentYear });
    const totalPayrollYTD = recentPayrolls.reduce((sum, p) => sum + p.netSalary, 0);
    const paidPayrolls = recentPayrolls
      .filter((p) => p.paymentStatus === 'Paid')
      .reduce((sum, p) => sum + p.netSalary, 0);

    // 5. Department Breakdown (Employees per department)
    const departments = await Department.find({ isActive: true });
    const departmentDistribution = await Promise.all(
      departments.map(async (d) => {
        const count = await Employee.countDocuments({ department: d._id, status: 'Active' });
        return {
          name: d.name,
          code: d.code,
          count,
        };
      })
    );

    // 6. Recent Audit Activities
    const recentActivities = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(6);

    return successResponse(
      res,
      {
        metrics: {
          totalEmployees,
          activeEmployees,
          totalDepartments,
          presentToday,
          onLeaveToday,
          totalPayrollYTD,
          paidPayrolls,
        },
        hiringStats,
        departmentDistribution,
        recentActivities,
      },
      'Super Admin dashboard data retrieved'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get HR Manager Dashboard Data
 * @route   GET /api/dashboard/hr
 * @access  Private (HR Manager, Super Admin)
 */
const getHRDashboard = async (req, res, next) => {
  try {
    const todayStart = getStartOfDay();
    const todayEnd = getEndOfDay();
    const now = new Date();

    // 1. Employee Overview
    const totalEmployees = await Employee.countDocuments({ status: { $ne: 'Terminated' } });
    const activeEmployees = await Employee.countDocuments({ status: 'Active' });
    const inactiveEmployees = await Employee.countDocuments({ status: 'Inactive' });

    // 2. Pending Leave Requests
    const pendingLeaves = await LeaveRequest.find({ status: 'Pending' })
      .populate('employee', 'firstName lastName fullName employeeId department designation profilePhoto')
      .sort({ createdAt: -1 })
      .limit(6);

    const pendingLeavesCount = await LeaveRequest.countDocuments({ status: 'Pending' });

    // 3. Today's Attendance Breakdown
    const presentCount = await Attendance.countDocuments({
      date: { $gte: todayStart, $lte: todayEnd },
      status: { $in: ['Present', 'Late'] },
    });
    const lateCount = await Attendance.countDocuments({
      date: { $gte: todayStart, $lte: todayEnd },
      status: 'Late',
    });
    const absentCount = Math.max(0, activeEmployees - presentCount);

    // 4. Upcoming Birthdays (Current month)
    const currentMonthNum = now.getMonth() + 1;
    const allEmployees = await Employee.find({ status: 'Active' })
      .populate('department', 'name')
      .select('firstName lastName fullName dateOfBirth designation profilePhoto department');

    const upcomingBirthdays = allEmployees
      .filter((emp) => {
        if (!emp.dateOfBirth) return false;
        const bdayMonth = new Date(emp.dateOfBirth).getMonth() + 1;
        return bdayMonth === currentMonthNum;
      })
      .map((emp) => {
        const bday = new Date(emp.dateOfBirth);
        return {
          _id: emp._id,
          fullName: emp.fullName,
          designation: emp.designation,
          department: emp.department?.name,
          profilePhoto: emp.profilePhoto,
          day: bday.getDate(),
          birthDate: bday,
        };
      })
      .sort((a, b) => a.day - b.day);

    // 5. New Joiners (joined in last 45 days)
    const fortyFiveDaysAgo = new Date();
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);

    const newJoiners = await Employee.find({
      joiningDate: { $gte: fortyFiveDaysAgo },
      status: 'Active',
    })
      .populate('department', 'name')
      .sort({ joiningDate: -1 })
      .limit(8);

    return successResponse(
      res,
      {
        employeeOverview: {
          total: totalEmployees,
          active: activeEmployees,
          inactive: inactiveEmployees,
        },
        attendanceSummary: {
          present: presentCount,
          late: lateCount,
          absent: absentCount,
        },
        pendingLeaves,
        pendingLeavesCount,
        upcomingBirthdays,
        newJoiners,
      },
      'HR Manager dashboard data retrieved'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Employee Dashboard Data
 * @route   GET /api/dashboard/employee
 * @access  Private (Employee, HR Manager, Super Admin)
 */
const getEmployeeDashboard = async (req, res, next) => {
  try {
    const employeeId = req.user.employeeProfile?._id || req.user.employeeProfile;
    if (!employeeId) {
      return errorResponse(res, 'No employee profile linked to user', 400);
    }

    const todayStart = getStartOfDay();
    const todayEnd = getEndOfDay();

    // 1. Personal Profile
    const employee = await Employee.findById(employeeId)
      .populate('department', 'name code location head')
      .populate('user', 'email role lastLogin');

    if (!employee) {
      return errorResponse(res, 'Employee record not found', 404);
    }

    // 2. Today's Attendance
    const todayAttendance = await Attendance.findOne({
      employee: employeeId,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    // 3. This Month Attendance Summary
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const monthAttendance = await Attendance.find({
      employee: employeeId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    });

    const presentDays = monthAttendance.filter((a) => ['Present', 'Late'].includes(a.status)).length;
    const lateDays = monthAttendance.filter((a) => a.status === 'Late').length;
    const totalHours = monthAttendance.reduce((acc, curr) => acc + (curr.workingHours || 0), 0);

    // 4. Leave Balance & Recent Leaves
    const leaveBalance = employee.leaveBalance;
    const recentLeaves = await LeaveRequest.find({ employee: employeeId })
      .sort({ createdAt: -1 })
      .limit(5);

    // 5. Salary History / Recent Payslips
    const recentPayrolls = await Payroll.find({ employee: employeeId })
      .sort({ year: -1, month: -1 })
      .limit(6);

    // 6. Recent Notifications
    const recentNotifications = await Notification.find({
      $or: [
        { recipient: req.user._id },
        { targetRole: req.user.role },
        { targetRole: 'All' },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(5);

    return successResponse(
      res,
      {
        profile: employee,
        todayAttendance,
        attendanceSummary: {
          presentDays,
          lateDays,
          totalHours: Math.round(totalHours * 10) / 10,
        },
        leaveBalance,
        recentLeaves,
        salaryHistory: recentPayrolls,
        recentNotifications,
      },
      'Employee dashboard data retrieved'
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSuperAdminDashboard,
  getHRDashboard,
  getEmployeeDashboard,
};
