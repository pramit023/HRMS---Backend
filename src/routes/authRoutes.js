const express = require('express');
const router = express.Router();
const {
  login,
  refreshToken,
  getMe,
  forgotPassword,
  resetPassword,
  updatePassword,
  forceChangePassword,
  logout,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Protected routes
router.get('/me', protect, getMe);
router.put('/update-password', protect, updatePassword);
router.post('/force-change-password', protect, forceChangePassword);
router.post('/logout', protect, logout);

module.exports = router;
