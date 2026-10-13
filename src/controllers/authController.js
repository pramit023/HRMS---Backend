const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Employee = require('../models/Employee');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { logAudit } = require('../services/auditService');

// Generate Access Token (JWT)
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET || 'enterprise_hrms_super_secret_jwt_key_2026_xyz987',
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
};

// Generate Refresh Token
const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET || 'enterprise_hrms_super_refresh_secret_jwt_key_2026_abc123',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

/**
 * @desc    Login User
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Please provide email and password', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+password')
      .populate('employeeProfile');

    if (!user) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    if (!user.isActive) {
      return errorResponse(res, 'Your account is deactivated. Contact Administrator.', 403);
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    await logAudit({
      req,
      user,
      action: 'LOGIN',
      module: 'Auth',
      details: { email: user.email, role: user.role },
    });

    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      employeeProfile: user.employeeProfile,
      mustChangePassword: user.mustChangePassword || false,
      isTemporaryPassword: user.isTemporaryPassword || false,
      lastLogin: user.lastLogin,
    };

    return successResponse(
      res,
      {
        user: userData,
        accessToken,
        refreshToken,
        mustChangePassword: user.mustChangePassword || false,
      },
      'Login successful'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Refresh Access Token
 * @route   POST /api/auth/refresh-token
 * @access  Public
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return errorResponse(res, 'Refresh token required', 400);
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'enterprise_hrms_super_refresh_secret_jwt_key_2026_abc123'
    );

    const user = await User.findById(decoded.id).populate('employeeProfile');
    if (!user || user.refreshToken !== refreshToken || !user.isActive) {
      return errorResponse(res, 'Invalid or expired refresh token', 401);
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    user.refreshToken = newRefreshToken;
    await user.save();

    return successResponse(res, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    }, 'Token refreshed successfully');
  } catch (error) {
    return errorResponse(res, 'Invalid refresh token', 401);
  }
};

/**
 * @desc    Get Current Logged in User Profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'employeeProfile',
        populate: { path: 'department', select: 'name code' },
      });

    return successResponse(res, user, 'User profile fetched');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Forgot Password - generates reset token
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return errorResponse(res, 'Please provide email', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't disclose user existence for security
      return successResponse(
        res,
        null,
        'If an account exists with this email, password reset instructions have been generated.'
      );
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    await logAudit({
      req,
      user,
      action: 'FORGOT_PASSWORD_REQUEST',
      module: 'Auth',
      details: { email: user.email },
    });

    // In production, send email via nodemailer. For enterprise demo, return resetToken in payload so user can test reset directly.
    return successResponse(
      res,
      { resetToken, note: 'Token returned for development convenience' },
      'Reset token generated. Check your email or use the provided token.'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset Password using token
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return errorResponse(res, 'Password must be at least 6 characters', 400);
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return errorResponse(res, 'Invalid or expired password reset token', 400);
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    await logAudit({
      req,
      user,
      action: 'PASSWORD_RESET_SUCCESS',
      module: 'Auth',
      details: { email: user.email },
    });

    return successResponse(res, null, 'Password successfully reset. You can now log in.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change Password (Authenticated)
 * @route   PUT /api/auth/update-password
 * @access  Private
 */
const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return errorResponse(res, 'Current password and new password are required', 400);
    }

    if (newPassword.length < 6) {
      return errorResponse(res, 'New password must be at least 6 characters', 400);
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return errorResponse(res, 'Current password is incorrect', 400);
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    user.isTemporaryPassword = false;
    await user.save();

    await logAudit({
      req,
      user,
      action: 'PASSWORD_CHANGE',
      module: 'Auth',
      details: { email: user.email },
    });

    return successResponse(res, null, 'Password updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Force Change Password on First Login
 * @route   POST /api/auth/force-change-password
 * @access  Private (Authenticated with temporary credentials)
 */
const forceChangePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return errorResponse(res, 'Current temporary password and new password are required', 400);
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return errorResponse(res, 'New password and confirmation do not match', 400);
    }

    if (newPassword.length < 8) {
      return errorResponse(res, 'New password must be at least 8 characters long', 400);
    }

    if (currentPassword === newPassword) {
      return errorResponse(res, 'New password cannot be the same as your temporary password', 400);
    }

    const user = await User.findById(req.user._id).select('+password').populate('employeeProfile');
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return errorResponse(res, 'Temporary password provided is incorrect', 400);
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    user.isTemporaryPassword = false;

    // Issue refreshed tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    user.refreshToken = newRefreshToken;

    await user.save();

    await logAudit({
      req,
      user,
      action: 'FIRST_LOGIN_PASSWORD_CHANGED',
      module: 'Auth',
      details: { email: user.email, role: user.role },
    });

    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      employeeProfile: user.employeeProfile,
      mustChangePassword: false,
      isTemporaryPassword: false,
    };

    return successResponse(
      res,
      {
        user: userData,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        mustChangePassword: false,
      },
      'Password successfully established! You now have full access to your dashboard.'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout User
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res, next) => {
  try {
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
      await logAudit({
        req,
        user: req.user,
        action: 'LOGOUT',
        module: 'Auth',
        details: { email: req.user.email },
      });
    }
    return successResponse(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  refreshToken,
  getMe,
  forgotPassword,
  resetPassword,
  updatePassword,
  forceChangePassword,
  logout,
};
