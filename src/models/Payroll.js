const mongoose = require('mongoose');

const PayrollSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },
    payPeriod: {
      type: String,
      required: true, // e.g. "March 2026"
    },
    basicSalary: {
      type: Number,
      required: true,
      default: 0,
    },
    hra: {
      type: Number,
      default: 0, // House Rent Allowance
    },
    allowances: {
      type: Number,
      default: 0, // Medical, transport, etc.
    },
    bonus: {
      type: Number,
      default: 0,
    },
    grossEarnings: {
      type: Number,
      required: true,
    },
    taxDeduction: {
      type: Number,
      default: 0,
    },
    pfDeduction: {
      type: Number,
      default: 0, // Provident Fund / 401k
    },
    otherDeductions: {
      type: Number,
      default: 0, // Unpaid leaves, insurance, etc.
    },
    totalDeductions: {
      type: Number,
      required: true,
    },
    netSalary: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['Bank Transfer', 'Direct Deposit', 'Cheque', 'Cash'],
      default: 'Bank Transfer',
    },
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Pending', 'Processing'],
      default: 'Pending',
    },
    paymentDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// One payroll entry per employee per month & year
PayrollSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', PayrollSchema);
