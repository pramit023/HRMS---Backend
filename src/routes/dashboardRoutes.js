const express = require('express');
const router = express.Router();
const {
  getSuperAdminDashboard,
  getHRDashboard,
  getEmployeeDashboard,
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/super-admin', authorize('Super Admin'), getSuperAdminDashboard);
router.get('/hr', authorize('Super Admin', 'HR Manager'), getHRDashboard);
router.get('/employee', getEmployeeDashboard);

module.exports = router;
