const mongoose = require('mongoose');

const GoalSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  targetDate: { type: Date },
  status: {
    type: String,
    enum: ['Not Started', 'In Progress', 'Completed', 'Behind'],
    default: 'In Progress',
  },
  progress: { type: Number, default: 0, min: 0, max: 100 },
});

const PerformanceReviewSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewPeriod: {
      type: String,
      required: true, // e.g. "Q1 2026", "Annual 2025"
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    metrics: {
      technicalSkills: { type: Number, min: 1, max: 5, default: 4 },
      communication: { type: Number, min: 1, max: 5, default: 4 },
      leadership: { type: Number, min: 1, max: 5, default: 4 },
      punctuality: { type: Number, min: 1, max: 5, default: 5 },
      workQuality: { type: Number, min: 1, max: 5, default: 4 },
    },
    goals: [GoalSchema],
    strengths: {
      type: String,
      default: '',
    },
    areasForImprovement: {
      type: String,
      default: '',
    },
    feedback: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Approved', 'Acknowledged'],
      default: 'Submitted',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PerformanceReview', PerformanceReviewSchema);
