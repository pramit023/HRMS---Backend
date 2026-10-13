const express = require('express');
const router = express.Router();
const {
  generateMonthlyPayroll,
  getPayrolls,
  getPayrollById,
  updatePayroll,
  downloadPayslipPDF,
  getPayrollSummary,
} = require('../controllers/payrollController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/summary', authorize('Super Admin', 'HR Manager'), getPayrollSummary);
router.post('/generate', authorize('Super Admin', 'HR Manager'), generateMonthlyPayroll);
router.get('/', getPayrolls);
router.get('/:id', getPayrollById);
router.put('/:id', authorize('Super Admin', 'HR Manager'), updatePayroll);
router.get('/:id/download-pdf', downloadPayslipPDF);

module.exports = router;
