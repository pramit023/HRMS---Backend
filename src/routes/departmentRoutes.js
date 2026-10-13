const express = require('express');
const router = express.Router();
const {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentStats,
} = require('../controllers/departmentController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/stats', getDepartmentStats);

router
  .route('/')
  .get(getDepartments)
  .post(authorize('Super Admin', 'HR Manager'), createDepartment);

router
  .route('/:id')
  .get(getDepartmentById)
  .put(authorize('Super Admin', 'HR Manager'), updateDepartment)
  .delete(authorize('Super Admin', 'HR Manager'), deleteDepartment);

module.exports = router;
