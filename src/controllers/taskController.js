const Task = require('../models/Task');
const Employee = require('../models/Employee');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { logAudit } = require('../services/auditService');
const { emitToUser } = require('../services/socketService');

/**
 * @desc    Get all tasks with filtering, search & pagination
 * @route   GET /api/tasks
 * @access  Private
 */
const getTasks = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      priority = '',
      assignedTo = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = {};

    // Role-based isolation: Employees only see tasks assigned to them
    if (req.user.role === 'Employee') {
      if (req.user.employeeProfile) {
        query.assignedTo = req.user.employeeProfile._id;
      } else {
        return successResponse(res, [], 'No employee profile linked', 200, {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        });
      }
    } else if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) {
      query.status = status;
    }

    if (priority) {
      query.priority = priority;
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const total = await Task.countDocuments(query);
    const tasks = await Task.find(query)
      .populate('assignedTo', 'firstName lastName fullName employeeId designation profilePhoto')
      .populate('assignedBy', 'name email role')
      .populate('department', 'name code')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    return successResponse(res, tasks, 'Tasks retrieved successfully', 200, {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single task by ID
 * @route   GET /api/tasks/:id
 * @access  Private
 */
const getTaskById = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName fullName employeeId designation profilePhoto')
      .populate('assignedBy', 'name email role')
      .populate('department', 'name code');

    if (!task) {
      return errorResponse(res, 'Task not found', 404);
    }

    // Ensure employee can only view their own task
    if (
      req.user.role === 'Employee' &&
      req.user.employeeProfile &&
      task.assignedTo._id.toString() !== req.user.employeeProfile._id.toString()
    ) {
      return errorResponse(res, 'Not authorized to view this task', 403);
    }

    return successResponse(res, task, 'Task retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new task
 * @route   POST /api/tasks
 * @access  Private (Super Admin, HR Admin, HR Manager, Manager)
 */
const createTask = async (req, res, next) => {
  try {
    const { title, description, assignedTo, dueDate, priority, department, tags } = req.body;

    if (!title || !assignedTo || !dueDate) {
      return errorResponse(res, 'Title, assigned employee, and due date are required', 400);
    }

    const employee = await Employee.findById(assignedTo).populate('user');
    if (!employee) {
      return errorResponse(res, 'Assigned employee not found', 404);
    }

    const task = await Task.create({
      title,
      description,
      assignedTo,
      assignedBy: req.user._id,
      department: department || employee.department,
      dueDate,
      priority: priority || 'Medium',
      status: 'Pending',
      progress: 0,
      tags: tags || [],
    });

    await logAudit({
      req,
      action: 'CREATE_TASK',
      module: 'Task',
      details: { taskId: task._id, title: task.title, assignedTo: employee.fullName },
    });

    // Notify employee via socket if connected
    if (employee.user) {
      emitToUser(employee.user._id.toString(), 'new_task', {
        taskId: task._id,
        title: task.title,
        priority: task.priority,
        dueDate: task.dueDate,
      });
    }

    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'firstName lastName fullName employeeId')
      .populate('assignedBy', 'name email');

    return successResponse(res, populatedTask, 'Task assigned successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update task details
 * @route   PUT /api/tasks/:id
 * @access  Private (Super Admin, HR Admin, HR Manager, Manager)
 */
const updateTask = async (req, res, next) => {
  try {
    const { title, description, assignedTo, dueDate, priority, status, progress, department, tags } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) {
      return errorResponse(res, 'Task not found', 404);
    }

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (assignedTo) task.assignedTo = assignedTo;
    if (dueDate) task.dueDate = dueDate;
    if (priority) task.priority = priority;
    if (department) task.department = department;
    if (tags) task.tags = tags;
    if (progress !== undefined) task.progress = progress;
    if (status) {
      task.status = status;
      if (status === 'Completed') {
        task.progress = 100;
        task.completedAt = new Date();
      }
    }

    await task.save();

    await logAudit({
      req,
      action: 'UPDATE_TASK',
      module: 'Task',
      details: { taskId: task._id, title: task.title, status: task.status },
    });

    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'firstName lastName fullName employeeId')
      .populate('assignedBy', 'name email');

    return successResponse(res, updatedTask, 'Task updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update task progress / complete status (Employee action)
 * @route   PATCH /api/tasks/:id/progress
 * @access  Private
 */
const updateTaskProgress = async (req, res, next) => {
  try {
    const { progress, status, note } = req.body;

    const task = await Task.findById(req.params.id).populate('assignedTo');
    if (!task) {
      return errorResponse(res, 'Task not found', 404);
    }

    // Role check: Employee can only update tasks assigned to them
    if (req.user.role === 'Employee') {
      if (
        !req.user.employeeProfile ||
        task.assignedTo._id.toString() !== req.user.employeeProfile._id.toString()
      ) {
        return errorResponse(res, 'You are only authorized to update your own assigned tasks', 403);
      }
    }

    if (progress !== undefined) {
      task.progress = Math.min(100, Math.max(0, Number(progress)));
      if (task.progress === 100) {
        task.status = 'Completed';
        task.completedAt = new Date();
      } else if (task.progress > 0 && task.status === 'Pending') {
        task.status = 'In Progress';
      }
    }

    if (status) {
      task.status = status;
      if (status === 'Completed') {
        task.progress = 100;
        task.completedAt = new Date();
      } else if (status === 'Pending') {
        task.completedAt = null;
      }
    }

    await task.save();

    await logAudit({
      req,
      action: 'UPDATE_TASK_PROGRESS',
      module: 'Task',
      details: { taskId: task._id, progress: task.progress, status: task.status, note },
    });

    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'firstName lastName fullName employeeId')
      .populate('assignedBy', 'name email');

    return successResponse(res, populatedTask, 'Task progress updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete task
 * @route   DELETE /api/tasks/:id
 * @access  Private (Super Admin, HR Admin, HR Manager, Manager)
 */
const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return errorResponse(res, 'Task not found', 404);
    }

    await Task.findByIdAndDelete(req.params.id);

    await logAudit({
      req,
      action: 'DELETE_TASK',
      module: 'Task',
      details: { taskId: req.params.id, title: task.title },
    });

    return successResponse(res, null, 'Task deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskProgress,
  deleteTask,
};
