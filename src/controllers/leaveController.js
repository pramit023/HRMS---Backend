const LeaveRequest = require('../models/LeaveRequest');
const Employee = require('../models/Employee');
const Notification = require('../models/Notification');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { logAudit } = require('../services/auditService');
const { sendRealtimeNotification } = require('../services/socketService');

// Map leave type to balance key
const balanceKeyMap = {
  'Casual Leave': 'casualLeave',
  'Sick Leave': 'sickLeave',
  'Earned Leave': 'earnedLeave',
  'Work From Home': 'workFromHome',
};

/**
 * @desc    Apply for Leave
 * @route   POST /api/leaves
 * @access  Private
 */
const applyLeave = async (req, res, next) => {
  try {
    const employeeId = req.user.employeeProfile?._id || req.user.employeeProfile;
    if (!employeeId) {
      return errorResponse(res, 'No employee profile linked to user', 400);
    }

    const { leaveType, startDate, endDate, reason } = req.body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return errorResponse(res, 'All fields are required', 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return errorResponse(res, 'End date cannot be earlier than start date', 400);
    }

    // Calculate number of days (inclusive)
    const diffTime = Math.abs(end - start);
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return errorResponse(res, 'Employee not found', 404);
    }

    // Check balance
    const balanceKey = balanceKeyMap[leaveType];
    const availableBalance = employee.leaveBalance[balanceKey] || 0;

    if (availableBalance < days) {
      return errorResponse(
        res,
        `Insufficient ${leaveType} balance. Requested: ${days} day(s), Available: ${availableBalance} day(s).`,
        400
      );
    }

    const leave = await LeaveRequest.create({
      employee: employee._id,
      leaveType,
      startDate: start,
      endDate: end,
      days,
      reason,
      status: 'Pending',
    });

    // Notify HR / Admins
    const notification = await Notification.create({
      targetRole: 'HR Manager',
      title: 'New Leave Application',
      message: `${employee.fullName} applied for ${days} day(s) of ${leaveType} (${startDate} to ${endDate})`,
      type: 'leave',
      link: '/leaves',
    });
    sendRealtimeNotification(notification);

    await logAudit({
      req,
      action: 'APPLY_LEAVE',
      module: 'Leave',
      details: { leaveId: leave._id, employee: employee.fullName, leaveType, days },
    });

    const populatedLeave = await LeaveRequest.findById(leave._id).populate(
      'employee',
      'firstName lastName fullName employeeId department designation profilePhoto'
    );

    return successResponse(res, populatedLeave, 'Leave request submitted successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Leaves (Employees get own, HR/Admin get all)
 * @route   GET /api/leaves
 * @access  Private
 */
const getLeaves = async (req, res, next) => {
  try {
    const { status, leaveType, employeeId, page = 1, limit = 10 } = req.query;
    const query = {};

    // Role-based visibility
    if (req.user.role === 'Employee') {
      const empId = req.user.employeeProfile?._id || req.user.employeeProfile;
      query.employee = empId;
    } else if (employeeId) {
      query.employee = employeeId;
    }

    if (status) query.status = status;
    if (leaveType) query.leaveType = leaveType;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await LeaveRequest.countDocuments(query);
    const leaves = await LeaveRequest.find(query)
      .populate('employee', 'firstName lastName fullName employeeId department designation profilePhoto leaveBalance')
      .populate('reviewedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    return successResponse(res, leaves, 'Leave records retrieved', 200, {
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
 * @desc    Get Current User's Leave Balances
 * @route   GET /api/leaves/balance
 * @access  Private
 */
const getLeaveBalance = async (req, res, next) => {
  try {
    const employeeId = req.user.employeeProfile?._id || req.user.employeeProfile;
    if (!employeeId) {
      return errorResponse(res, 'No employee profile linked to user', 400);
    }

    const employee = await Employee.findById(employeeId).select('leaveBalance fullName');
    if (!employee) {
      return errorResponse(res, 'Employee not found', 404);
    }

    // Also get counts of pending/approved leaves
    const pendingCount = await LeaveRequest.countDocuments({
      employee: employeeId,
      status: 'Pending',
    });
    const approvedCount = await LeaveRequest.countDocuments({
      employee: employeeId,
      status: 'Approved',
    });

    return successResponse(
      res,
      {
        balance: employee.leaveBalance,
        stats: { pendingCount, approvedCount },
      },
      'Leave balance retrieved'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Approve Leave Request
 * @route   PUT /api/leaves/:id/approve
 * @access  Private (Super Admin, HR Manager)
 */
const approveLeave = async (req, res, next) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id).populate('employee');
    if (!leave) {
      return errorResponse(res, 'Leave request not found', 404);
    }

    if (leave.status !== 'Pending') {
      return errorResponse(res, `Cannot approve leave with status '${leave.status}'`, 400);
    }

    const employee = await Employee.findById(leave.employee._id);
    const balanceKey = balanceKeyMap[leave.leaveType];

    // Deduct leave balance
    if (employee && employee.leaveBalance[balanceKey] !== undefined) {
      employee.leaveBalance[balanceKey] = Math.max(
        0,
        employee.leaveBalance[balanceKey] - leave.days
      );
      await employee.save();
    }

    leave.status = 'Approved';
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = new Date();
    leave.comments = req.body.comments || 'Approved by HR';
    await leave.save();

    // Create Notification for the employee
    if (employee.user) {
      const notif = await Notification.create({
        recipient: employee.user,
        title: 'Leave Request Approved',
        message: `Your ${leave.leaveType} for ${leave.days} day(s) has been approved.`,
        type: 'leave',
        link: '/leaves',
      });
      sendRealtimeNotification(notif);
    }

    await logAudit({
      req,
      action: 'APPROVE_LEAVE',
      module: 'Leave',
      details: {
        leaveId: leave._id,
        employee: employee.fullName,
        days: leave.days,
        leaveType: leave.leaveType,
      },
    });

    const updated = await LeaveRequest.findById(leave._id)
      .populate('employee', 'firstName lastName fullName employeeId department')
      .populate('reviewedBy', 'name role');

    return successResponse(res, updated, 'Leave request approved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reject Leave Request
 * @route   PUT /api/leaves/:id/reject
 * @access  Private (Super Admin, HR Manager)
 */
const rejectLeave = async (req, res, next) => {
  try {
    const { rejectionReason = 'Does not meet operational requirements' } = req.body;
    const leave = await LeaveRequest.findById(req.params.id).populate('employee');

    if (!leave) {
      return errorResponse(res, 'Leave request not found', 404);
    }

    if (leave.status !== 'Pending') {
      return errorResponse(res, `Cannot reject leave with status '${leave.status}'`, 400);
    }

    leave.status = 'Rejected';
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = new Date();
    leave.rejectionReason = rejectionReason;
    await leave.save();

    // Notify employee
    if (leave.employee?.user) {
      const notif = await Notification.create({
        recipient: leave.employee.user,
        title: 'Leave Request Rejected',
        message: `Your ${leave.leaveType} was rejected. Reason: ${rejectionReason}`,
        type: 'leave',
        link: '/leaves',
      });
      sendRealtimeNotification(notif);
    }

    await logAudit({
      req,
      action: 'REJECT_LEAVE',
      module: 'Leave',
      details: {
        leaveId: leave._id,
        employee: leave.employee.fullName,
        reason: rejectionReason,
      },
    });

    const updated = await LeaveRequest.findById(leave._id)
      .populate('employee', 'firstName lastName fullName employeeId department')
      .populate('reviewedBy', 'name role');

    return successResponse(res, updated, 'Leave request rejected');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel Leave Request (Employee self-cancellation)
 * @route   PUT /api/leaves/:id/cancel
 * @access  Private
 */
const cancelLeave = async (req, res, next) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) {
      return errorResponse(res, 'Leave request not found', 404);
    }

    if (leave.status !== 'Pending') {
      return errorResponse(res, 'Only pending leave requests can be cancelled', 400);
    }

    leave.status = 'Cancelled';
    await leave.save();

    return successResponse(res, leave, 'Leave request cancelled successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  applyLeave,
  getLeaves,
  getLeaveBalance,
  approveLeave,
  rejectLeave,
  cancelLeave,
};
