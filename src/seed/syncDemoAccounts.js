const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Department = require('../models/Department');
const Employee = require('../models/Employee');

const syncAccounts = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    console.log('[Sync] Connecting to database...');
    await mongoose.connect(mongoUri);
    console.log('[Sync] Connected successfully.');

    // 1. Ensure HR Department
    let hrDept = await Department.findOne({ code: 'HR' });
    if (!hrDept) {
      hrDept = await Department.create({
        name: 'Human Resources & People Ops',
        code: 'HR',
        description: 'Talent acquisition, employee engagement, workplace culture and compliance',
        budget: 380000,
        location: 'Tower A - Floor 2',
      });
      console.log('[Sync] Created HR Department');
    }

    // 2. Ensure ENG Department
    let engDept = await Department.findOne({ code: 'ENG' });
    if (!engDept) {
      engDept = await Department.create({
        name: 'Engineering & Technology',
        code: 'ENG',
        description: 'Software development, cloud infrastructure, AI architecture and QA engineering',
        budget: 1250000,
        location: 'Tower A - Floor 4',
      });
      console.log('[Sync] Created Engineering Department');
    }

    // 3. Ensure Admin user password is Admin123!
    let adminUser = await User.findOne({ email: 'admin@enterprisehrms.com' });
    if (adminUser) {
      adminUser.password = 'Admin123!';
      adminUser.role = 'Super Admin';
      adminUser.isActive = true;
      adminUser.mustChangePassword = false;
      adminUser.isTemporaryPassword = false;
      await adminUser.save();
      console.log('[Sync] Super Admin password refreshed: Admin123!');
    } else {
      adminUser = await User.create({
        name: 'Super Admin',
        email: 'admin@enterprisehrms.com',
        password: 'Admin123!',
        role: 'Super Admin',
        isActive: true,
        mustChangePassword: false,
        isTemporaryPassword: false,
      });
      console.log('[Sync] Super Admin created');
    }

    // 4. Ensure HR Manager Employee & User
    let hrEmp = await Employee.findOne({ email: 'hrmanager@enterprisehrms.com' });
    if (!hrEmp) {
      hrEmp = await Employee.create({
        employeeId: 'EMP-1001',
        firstName: 'Sarah',
        lastName: 'Jenkins',
        fullName: 'Sarah Jenkins',
        email: 'hrmanager@enterprisehrms.com',
        phone: '+1 (555) 234-5678',
        gender: 'Female',
        department: hrDept._id,
        designation: 'VP of Human Resources',
        status: 'Active',
        salary: 115000,
        joiningDate: new Date('2022-01-10'),
        dateOfBirth: new Date('1988-04-14'),
        address: {
          street: '742 Evergreen Terrace',
          city: 'San Francisco',
          state: 'CA',
          country: 'USA',
          zipCode: '94107',
        },
      });
      console.log('[Sync] Created HR Employee profile');
    }

    let hrUser = await User.findOne({ email: 'hrmanager@enterprisehrms.com' });
    if (!hrUser) {
      hrUser = await User.create({
        name: 'Sarah Jenkins (HR Manager)',
        email: 'hrmanager@enterprisehrms.com',
        password: 'HR123!',
        role: 'HR Manager',
        employeeProfile: hrEmp._id,
        isActive: true,
        mustChangePassword: false,
        isTemporaryPassword: false,
      });
      console.log('[Sync] Created HR Manager User account');
    } else {
      hrUser.password = 'HR123!';
      hrUser.role = 'HR Manager';
      hrUser.employeeProfile = hrEmp._id;
      hrUser.isActive = true;
      hrUser.mustChangePassword = false;
      hrUser.isTemporaryPassword = false;
      await hrUser.save();
      console.log('[Sync] Updated HR Manager User account: HR123!');
    }
    hrEmp.user = hrUser._id;
    await hrEmp.save();
    hrDept.head = hrEmp._id;
    await hrDept.save();

    // 5. Ensure Demo Employee (Alex Morgan) Employee & User
    let alexEmp = await Employee.findOne({ email: 'alex.morgan@enterprisehrms.com' });
    if (!alexEmp) {
      alexEmp = await Employee.create({
        employeeId: 'EMP-1002',
        firstName: 'Alex',
        lastName: 'Morgan',
        fullName: 'Alex Morgan',
        email: 'alex.morgan@enterprisehrms.com',
        phone: '+1 (555) 345-6789',
        gender: 'Male',
        department: engDept._id,
        designation: 'Lead Full Stack Architect',
        status: 'Active',
        salary: 145000,
        joiningDate: new Date('2022-03-15'),
        dateOfBirth: new Date('1992-06-20'),
        address: {
          street: '100 Innovation Way',
          city: 'San Francisco',
          state: 'CA',
          country: 'USA',
          zipCode: '94105',
        },
      });
      console.log('[Sync] Created Alex Morgan Employee profile');
    }

    let alexUser = await User.findOne({ email: 'alex.morgan@enterprisehrms.com' });
    if (!alexUser) {
      alexUser = await User.create({
        name: 'Alex Morgan',
        email: 'alex.morgan@enterprisehrms.com',
        password: 'Emp123!',
        role: 'Employee',
        employeeProfile: alexEmp._id,
        isActive: true,
        mustChangePassword: false,
        isTemporaryPassword: false,
      });
      console.log('[Sync] Created Alex Morgan User account');
    } else {
      alexUser.password = 'Emp123!';
      alexUser.role = 'Employee';
      alexUser.employeeProfile = alexEmp._id;
      alexUser.isActive = true;
      alexUser.mustChangePassword = false;
      alexUser.isTemporaryPassword = false;
      await alexUser.save();
      console.log('[Sync] Updated Alex Morgan User account: Emp123!');
    }
    alexEmp.user = alexUser._id;
    await alexEmp.save();

    // 6. Update any other employees in the database to also have password Emp123!
    const otherUsers = await User.find({
      email: { $nin: ['admin@enterprisehrms.com', 'hrmanager@enterprisehrms.com', 'alex.morgan@enterprisehrms.com'] },
    });

    for (const u of otherUsers) {
      u.password = 'Emp123!';
      u.isActive = true;
      u.mustChangePassword = false;
      u.isTemporaryPassword = false;
      await u.save();
      console.log(`[Sync] Set password Emp123! for user: ${u.email}`);
    }

    console.log('\n======================================================');
    console.log(' ALL LOGIN CREDENTIALS SYNCHRONIZED SUCCESSFULLY!');
    console.log('======================================================');
    console.log('1. Super Admin: admin@enterprisehrms.com       / Admin123!');
    console.log('2. HR Manager:  hrmanager@enterprisehrms.com   / HR123!');
    console.log('3. Employee:    alex.morgan@enterprisehrms.com / Emp123!');
    if (otherUsers.length > 0) {
      console.log('4. Other Active Employees (all password Emp123!):');
      otherUsers.forEach(u => console.log(`   - ${u.email} / Emp123!`));
    }
    console.log('======================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('[Sync Error]', error);
    process.exit(1);
  }
};

syncAccounts();
