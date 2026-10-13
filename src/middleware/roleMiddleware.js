const { errorResponse } = require('../utils/apiResponse');

/**
 * Grant access to specific roles
 * e.g. authorize('Super Admin', 'HR Manager')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401);
    }

    const effectiveRoles = [...roles];
    if (effectiveRoles.includes('HR Manager') && !effectiveRoles.includes('HR Admin')) {
      effectiveRoles.push('HR Admin');
    }
    if (effectiveRoles.includes('HR Admin') && !effectiveRoles.includes('HR Manager')) {
      effectiveRoles.push('HR Manager');
    }

    if (!effectiveRoles.includes(req.user.role)) {
      return errorResponse(
        res,
        `Role [${req.user.role}] is not authorized to access this resource`,
        403
      );
    }
    next();
  };
};

module.exports = {
  authorize,
};
