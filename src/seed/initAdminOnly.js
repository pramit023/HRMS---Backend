const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Department = require('../models/Department');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const Payroll = require('../models/Payroll');
const PerformanceReview = require('../models/PerformanceReview');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');

const initAdminOnly = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    console.log('[Init] Connecting to MongoDB Atlas:', mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
    await mongoose.connect(mongoUri);
    console.log('[Init] Connected successfully.');

    // Wipe all collections
    await User.deleteMany({});
    await Department.deleteMany({});
    await Employee.deleteMany({});
    await Attendance.deleteMany({});
    await LeaveRequest.deleteMany({});
    await Payroll.deleteMany({});
    await PerformanceReview.deleteMany({});
    await Notification.deleteMany({});
    await AuditLog.deleteMany({});

    console.log('[Init] All dummy data wiped completely.');

    // Create 1 clean initial Super Admin account
    const admin = await User.create({
      name: 'Super Admin',
      email: 'admin@enterprisehrms.com',
      password: 'Admin123!',
      role: 'Super Admin',
      status: 'Active',
    });

    console.log('[Init] Initial Super Admin created:');
    console.log('       Email:    admin@enterprisehrms.com');
    console.log('       Password: Admin123!');
    console.log('       Role:     Super Admin');

    process.exit(0);
  } catch (error) {
    console.error('[Init Error]:', error.message);
    process.exit(1);
  }
};

initAdminOnly();
