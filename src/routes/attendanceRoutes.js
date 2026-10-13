const express = require('express');
const router = express.Router();
const {
  checkIn,
  checkOut,
  getTodayStatus,
  getDailyAttendance,
  getAttendanceHistory,
  manualAttendance,
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/today', getTodayStatus);
router.get('/daily', authorize('Super Admin', 'HR Manager'), getDailyAttendance);
router.get('/history/:employeeId?', getAttendanceHistory);
router.post('/manual', authorize('Super Admin', 'HR Manager'), manualAttendance);

module.exports = router;
