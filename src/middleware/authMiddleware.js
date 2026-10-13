const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { errorResponse } = require('../utils/apiResponse');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return errorResponse(res, 'Not authorized, no token provided', 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'enterprise_hrms_super_secret_jwt_key_2026_xyz987');
    const user = await User.findById(decoded.id).populate('employeeProfile');

    if (!user) {
      return errorResponse(res, 'User not found with this token', 401);
    }

    if (!user.isActive) {
      return errorResponse(res, 'Your account has been deactivated. Please contact HR.', 403);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token expired, please refresh or log in again', 401);
    }
    return errorResponse(res, 'Not authorized, token invalid', 401);
  }
};

module.exports = {
  protect,
};
