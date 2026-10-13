const express = require('express');
const router = express.Router();
const {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskProgress,
  deleteTask,
} = require('../controllers/taskController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router
  .route('/')
  .get(getTasks)
  .post(authorize('Super Admin', 'HR Admin', 'HR Manager', 'Manager'), createTask);

router
  .route('/:id')
  .get(getTaskById)
  .put(authorize('Super Admin', 'HR Admin', 'HR Manager', 'Manager'), updateTask)
  .delete(authorize('Super Admin', 'HR Admin', 'HR Manager', 'Manager'), deleteTask);

router.patch('/:id/progress', updateTaskProgress);

module.exports = router;
