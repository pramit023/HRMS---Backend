const express = require('express');
const router = express.Router();
const {
  getReviews,
  getReviewById,
  createReview,
  updateReview,
  deleteReview,
} = require('../controllers/performanceController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router
  .route('/')
  .get(getReviews)
  .post(authorize('Super Admin', 'HR Manager'), createReview);

router
  .route('/:id')
  .get(getReviewById)
  .put(updateReview)
  .delete(authorize('Super Admin'), deleteReview);

module.exports = router;
