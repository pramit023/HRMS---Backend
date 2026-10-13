const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { logAudit } = require('../services/auditService');

// Normalize date to start of day in UTC/local
const getStartOfDay = (dateString) => {
  const d = dateString ? new Date(dateString) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const getEndOfDay = (dateString) => {
  const d = dateString ? new Date(dateString) : new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * @desc    Employee Check-In
 * @route   POST /api/attendance/check-in
 * @access  Private
 */
const checkIn = async (req, res, next) => {
  try {
    const employeeId = req.user.employeeProfile?._id || req.user.employeeProfile;
    if (!employeeId) {
      return errorResponse(res, 'No employee profile linked to current user', 400);
    }

    const todayStart = getStartOfDay();
    const todayEnd = getEndOfDay();

    let record = await Attendance.findOne({
      employee: employeeId,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    if (record && record.checkIn) {
      return errorResponse(res, `You have already checked in today at ${new Date(record.checkIn).toLocaleTimeString()}`, 400);
    }

    const now = new Date();
    // If check-in after 9:30 AM local time, mark Late
    const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30);
    const status = isLate ? 'Late' : 'Present';

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;

    if (!record) {
      record = new Attendance({
        employee: employeeId,
        date: todayStart,
        checkIn: now,
        status,
        ipAddress: clientIp,
        notes: req.body.notes || (isLate ? 'Checked in after 9:30 AM' : 'On-time check in'),
      });
    } else {
      record.checkIn = now;
      record.status = status;
    }

    await record.save();

    return successResponse(res, record, 'Checked in successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Employee Check-Out
 * @route   POST /api/attendance/check-out
 * @access  Private
 */
const checkOut = async (req, res, next) => {
  try {
    const employeeId = req.user.employeeProfile?._id || req.user.employeeProfile;
    if (!employeeId) {
      return errorResponse(res, 'No employee profile linked to current user', 400);
    }

    const todayStart = getStartOfDay();
    const todayEnd = getEndOfDay();

    const record = await Attendance.findOne({
      employee: employeeId,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    if (!record || !record.checkIn) {
      return errorResponse(res, 'You must check in before checking out', 400);
    }

    const now = new Date();
    record.checkOut = now;

    // Calculate hours
    const diffMs = now.getTime() - new Date(record.checkIn).getTime();
    const hours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
    record.workingHours = hours;

    if (hours < 4 && record.status === 'Present') {
      record.status = 'Half Day';
    }

    await record.save();

    return successResponse(res, record, `Checked out successfully (${hours} hours worked)`);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user's today attendance status
 * @route   GET /api/attendance/today
 * @access  Private
 */
const getTodayStatus = async (req, res, next) => {
  try {
    const employeeId = req.user.employeeProfile?._id || req.user.employeeProfile;
    if (!employeeId) {
      return successResponse(res, null, 'No employee profile linked');
    }

    const todayStart = getStartOfDay();
    const todayEnd = getEndOfDay();

    const record = await Attendance.findOne({
      employee: employeeId,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    return successResponse(res, record, 'Today status fetched');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get daily attendance for all employees (Admin/HR view)
 * @route   GET /api/attendance/daily
 * @access  Private (Super Admin, HR Manager)
 */
const getDailyAttendance = async (req, res, next) => {
  try {
    const { date, department, status } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const start = getStartOfDay(targetDate);
    const end = getEndOfDay(targetDate);

    // Get active employees
    const empQuery = { status: { $ne: 'Terminated' } };
    if (department) {
      empQuery.department = department;
    }

    const employees = await Employee.find(empQuery)
      .populate('department', 'name code')
      .sort({ firstName: 1 });

    const attendanceRecords = await Attendance.find({
      date: { $gte: start, $lte: end },
    });

    const attendanceMap = new Map();
    attendanceRecords.forEach((att) => {
      attendanceMap.set(att.employee.toString(), att);
    });

    const combined = employees.map((emp) => {
      const att = attendanceMap.get(emp._id.toString());
      return {
        employee: emp,
        attendance: att || {
          status: 'Absent',
          checkIn: null,
          checkOut: null,
          workingHours: 0,
        },
      };
    });

    const filtered = status
      ? combined.filter((c) => c.attendance.status.toLowerCase() === status.toLowerCase())
      : combined;

    const summary = {
      totalEmployees: employees.length,
      present: combined.filter((c) => ['Present', 'Late'].includes(c.attendance.status)).length,
      late: combined.filter((c) => c.attendance.status === 'Late').length,
      absent: combined.filter((c) => c.attendance.status === 'Absent').length,
      halfDay: combined.filter((c) => c.attendance.status === 'Half Day').length,
      onLeave: combined.filter((c) => c.attendance.status === 'On Leave').length,
    };

    return successResponse(
      res,
      { records: filtered, summary, date: targetDate },
      'Daily attendance retrieved'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get employee attendance history
 * @route   GET /api/attendance/history/:employeeId?
 * @access  Private
 */
const getAttendanceHistory = async (req, res, next) => {
  try {
    let empId = req.params.employeeId;

    if (!empId || empId === 'me') {
      empId = req.user.employeeProfile?._id || req.user.employeeProfile;
    }

    const { month, year } = req.query;
    const query = { employee: empId };

    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const records = await Attendance.find(query)
      .populate('employee', 'firstName lastName fullName employeeId department')
      .sort({ date: -1 });

    const totalDays = records.length;
    const presentDays = records.filter((r) => ['Present', 'Late'].includes(r.status)).length;
    const lateDays = records.filter((r) => r.status === 'Late').length;
    const totalHours = records.reduce((acc, curr) => acc + (curr.workingHours || 0), 0);

    return successResponse(
      res,
      {
        records,
        stats: {
          totalDays,
          presentDays,
          lateDays,
          totalHours: Math.round(totalHours * 10) / 10,
          averageHours: totalDays ? Math.round((totalHours / totalDays) * 10) / 10 : 0,
        },
      },
      'Attendance history retrieved'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin/HR manual attendance create or update
 * @route   POST /api/attendance/manual
 * @access  Private (Super Admin, HR Manager)
 */
const manualAttendance = async (req, res, next) => {
  try {
    const { employeeId, date, checkIn, checkOut, status, notes } = req.body;

    const start = getStartOfDay(date);
    const end = getEndOfDay(date);

    let record = await Attendance.findOne({
      employee: employeeId,
      date: { $gte: start, $lte: end },
    });

    let hours = 0;
    if (checkIn && checkOut) {
      const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
      hours = Math.max(0, Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10);
    }

    if (!record) {
      record = new Attendance({
        employee: employeeId,
        date: start,
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        workingHours: hours,
        status: status || 'Present',
        notes: notes || 'Manual entry by Admin/HR',
      });
    } else {
      if (checkIn !== undefined) record.checkIn = checkIn ? new Date(checkIn) : null;
      if (checkOut !== undefined) record.checkOut = checkOut ? new Date(checkOut) : null;
      if (status) record.status = status;
      if (notes) record.notes = notes;
      record.workingHours = hours;
    }

    await record.save();

    await logAudit({
      req,
      action: 'MANUAL_ATTENDANCE_OVERRIDE',
      module: 'Attendance',
      details: { employeeId, date, status },
    });

    return successResponse(res, record, 'Attendance record updated successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkIn,
  checkOut,
  getTodayStatus,
  getDailyAttendance,
  getAttendanceHistory,
  manualAttendance,
};
