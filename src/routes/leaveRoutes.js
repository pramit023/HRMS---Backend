const express = require('express');
const router = express.Router();
const {
  applyLeave,
  getLeaves,
  getLeaveBalance,
  approveLeave,
  rejectLeave,
  cancelLeave,
} = require('../controllers/leaveController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.route('/')
  .post(applyLeave)
  .get(getLeaves);

router.get('/balance', getLeaveBalance);
router.put('/:id/approve', authorize('Super Admin', 'HR Manager'), approveLeave);
router.put('/:id/reject', authorize('Super Admin', 'HR Manager'), rejectLeave);
router.put('/:id/cancel', cancelLeave);

module.exports = router;
