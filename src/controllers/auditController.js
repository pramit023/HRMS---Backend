const AuditLog = require('../models/AuditLog');
const { successResponse } = require('../utils/apiResponse');

/**
 * @desc    Get audit logs with search, filter, and pagination
 * @route   GET /api/audit
 * @access  Private (Super Admin)
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const { module, action, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (module) query.module = module;
    if (action) query.action = { $regex: action, $options: 'i' };
    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
        { ipAddress: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    return successResponse(res, logs, 'Audit logs retrieved', 200, {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs,
};
