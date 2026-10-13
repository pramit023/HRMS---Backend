const express = require('express');
const router = express.Router();
const {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  uploadPhoto,
  uploadDocument,
  deleteDocument,
} = require('../controllers/employeeController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

router
  .route('/')
  .get(getAllEmployees)
  .post(authorize('Super Admin', 'HR Manager'), createEmployee);

router
  .route('/:id')
  .get(getEmployeeById)
  .put(authorize('Super Admin', 'HR Manager'), updateEmployee)
  .delete(authorize('Super Admin', 'HR Manager', 'HR Admin'), deleteEmployee);

router.post('/:id/photo', upload.single('photo'), uploadPhoto);
router.post(
  '/:id/documents',
  authorize('Super Admin', 'HR Manager'),
  upload.single('document'),
  uploadDocument
);
router.delete(
  '/:id/documents/:docId',
  authorize('Super Admin', 'HR Manager'),
  deleteDocument
);

module.exports = router;
