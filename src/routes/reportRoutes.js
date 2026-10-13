const express = require('express');
const router = express.Router();
const {
  getAttendanceReport,
  getLeaveReport,
  getPayrollReport,
  getEmployeeReport,
} = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);
router.use(authorize('Super Admin', 'HR Manager'));

router.get('/attendance', getAttendanceReport);
router.get('/leave', getLeaveReport);
router.get('/payroll', getPayrollReport);
router.get('/employee', getEmployeeReport);

module.exports = router;
