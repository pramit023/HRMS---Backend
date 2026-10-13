const PerformanceReview = require('../models/PerformanceReview');
const Employee = require('../models/Employee');
const Notification = require('../models/Notification');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { logAudit } = require('../services/auditService');
const { sendRealtimeNotification } = require('../services/socketService');

/**
 * @desc    Get performance reviews (Employee gets own, HR/Admin get all)
 * @route   GET /api/performance
 * @access  Private
 */
const getReviews = async (req, res, next) => {
  try {
    const { employeeId, period, status } = req.query;
    const query = {};

    if (req.user.role === 'Employee') {
      const empId = req.user.employeeProfile?._id || req.user.employeeProfile;
      query.employee = empId;
    } else if (employeeId) {
      query.employee = employeeId;
    }

    if (period) query.reviewPeriod = period;
    if (status) query.status = status;

    const reviews = await PerformanceReview.find(query)
      .populate('employee', 'firstName lastName fullName employeeId designation department profilePhoto')
      .populate('reviewer', 'name email role')
      .sort({ createdAt: -1 });

    return successResponse(res, reviews, 'Performance reviews retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single review
 * @route   GET /api/performance/:id
 * @access  Private
 */
const getReviewById = async (req, res, next) => {
  try {
    const review = await PerformanceReview.findById(req.params.id)
      .populate('employee', 'firstName lastName fullName employeeId designation department profilePhoto')
      .populate('reviewer', 'name email role');

    if (!review) {
      return errorResponse(res, 'Performance review not found', 404);
    }

    return successResponse(res, review, 'Review details retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create Performance Review
 * @route   POST /api/performance
 * @access  Private (Super Admin, HR Manager)
 */
const createReview = async (req, res, next) => {
  try {
    const {
      employeeId,
      reviewPeriod,
      rating,
      metrics,
      goals,
      strengths,
      areasForImprovement,
      feedback,
      status = 'Submitted',
    } = req.body;

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return errorResponse(res, 'Employee not found', 404);
    }

    const review = await PerformanceReview.create({
      employee: employeeId,
      reviewer: req.user._id,
      reviewPeriod,
      rating,
      metrics: metrics || {},
      goals: goals || [],
      strengths,
      areasForImprovement,
      feedback,
      status,
    });

    if (employee.user) {
      const notif = await Notification.create({
        recipient: employee.user,
        title: 'New Performance Review',
        message: `Your performance review for ${reviewPeriod} has been submitted (Rating: ${rating}/5).`,
        type: 'performance',
        link: '/performance',
      });
      sendRealtimeNotification(notif);
    }

    await logAudit({
      req,
      action: 'CREATE_PERFORMANCE_REVIEW',
      module: 'Performance',
      details: { employee: employee.fullName, reviewPeriod, rating },
    });

    const populated = await PerformanceReview.findById(review._id)
      .populate('employee', 'firstName lastName fullName employeeId designation department')
      .populate('reviewer', 'name email role');

    return successResponse(res, populated, 'Performance review created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update review or goals progress
 * @route   PUT /api/performance/:id
 * @access  Private
 */
const updateReview = async (req, res, next) => {
  try {
    const review = await PerformanceReview.findById(req.params.id);
    if (!review) {
      return errorResponse(res, 'Performance review not found', 404);
    }

    const {
      rating,
      metrics,
      goals,
      strengths,
      areasForImprovement,
      feedback,
      status,
    } = req.body;

    if (rating !== undefined) review.rating = rating;
    if (metrics) review.metrics = { ...review.metrics, ...metrics };
    if (goals) review.goals = goals;
    if (strengths !== undefined) review.strengths = strengths;
    if (areasForImprovement !== undefined) review.areasForImprovement = areasForImprovement;
    if (feedback !== undefined) review.feedback = feedback;
    if (status) review.status = status;

    await review.save();

    const updated = await PerformanceReview.findById(review._id)
      .populate('employee', 'firstName lastName fullName employeeId designation department')
      .populate('reviewer', 'name email role');

    return successResponse(res, updated, 'Performance review updated');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete review
 * @route   DELETE /api/performance/:id
 * @access  Private (Super Admin)
 */
const deleteReview = async (req, res, next) => {
  try {
    const review = await PerformanceReview.findById(req.params.id);
    if (!review) {
      return errorResponse(res, 'Performance review not found', 404);
    }

    await PerformanceReview.findByIdAndDelete(req.params.id);

    return successResponse(res, null, 'Performance review deleted');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getReviews,
  getReviewById,
  createReview,
  updateReview,
  deleteReview,
};
