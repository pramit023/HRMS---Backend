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

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hrms_enterprise';
    await mongoose.connect(mongoUri);
    console.log('[Seeder] Connected to MongoDB:', mongoUri);

    // Clear existing data
    await User.deleteMany({});
    await Department.deleteMany({});
    await Employee.deleteMany({});
    await Attendance.deleteMany({});
    await LeaveRequest.deleteMany({});
    await Payroll.deleteMany({});
    await PerformanceReview.deleteMany({});
    await Notification.deleteMany({});
    await AuditLog.deleteMany({});

    console.log('[Seeder] Cleaned existing collections');

    // 1. Create Departments
    const engineering = await Department.create({
      name: 'Engineering & Technology',
      code: 'ENG',
      description: 'Software development, cloud infrastructure, AI architecture and QA engineering',
      budget: 1250000,
      location: 'Tower A - Floor 4',
    });

    const hrDept = await Department.create({
      name: 'Human Resources & People Ops',
      code: 'HR',
      description: 'Talent acquisition, employee engagement, workplace culture and compliance',
      budget: 380000,
      location: 'Tower A - Floor 2',
    });

    const salesDept = await Department.create({
      name: 'Global Sales & Marketing',
      code: 'SALES',
      description: 'Enterprise B2B growth, client success, product marketing and branding',
      budget: 720000,
      location: 'Tower B - Floor 3',
    });

    const financeDept = await Department.create({
      name: 'Finance & Operations',
      code: 'FIN',
      description: 'Corporate financial planning, tax compliance, payroll auditing and accounting',
      budget: 490000,
      location: 'Tower A - Floor 5',
    });

    const productDept = await Department.create({
      name: 'Product & Design',
      code: 'PROD',
      description: 'User experience research, UI architecture, product roadmapping and strategy',
      budget: 550000,
      location: 'Tower B - Floor 2',
    });

    console.log('[Seeder] Created 5 departments');

    // 2. Create Users & Employees
    // Super Admin User
    const adminUser = await User.create({
      name: 'Eleanor Vance (Super Admin)',
      email: 'admin@enterprisehrms.com',
      password: 'Admin123!',
      role: 'Super Admin',
      isActive: true,
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    });

    // HR Manager User & Employee
    const hrEmp = await Employee.create({
      employeeId: 'EMP-1001',
      firstName: 'Sarah',
      lastName: 'Jenkins',
      fullName: 'Sarah Jenkins',
      email: 'hrmanager@enterprisehrms.com',
      phone: '+1 (555) 234-5678',
      address: {
        street: '742 Evergreen Terrace',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        zipCode: '94107',
      },
      gender: 'Female',
      dateOfBirth: new Date('1988-04-14'),
      department: hrDept._id,
      designation: 'VP of Human Resources',
      joiningDate: new Date('2022-01-10'),
      salary: 115000,
      status: 'Active',
      profilePhoto: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
      emergencyContact: {
        name: 'Robert Jenkins',
        relationship: 'Spouse',
        phone: '+1 (555) 998-1122',
      },
      bankDetails: {
        accountName: 'Sarah Jenkins',
        accountNumber: '987654321012',
        bankName: 'Silicon Valley Premier Bank',
        routingOrIfsc: 'SVPB000192',
      },
      leaveBalance: {
        casualLeave: 10,
        sickLeave: 9,
        earnedLeave: 14,
        workFromHome: 22,
      },
    });

    const hrUser = await User.create({
      name: 'Sarah Jenkins (HR Manager)',
      email: 'hrmanager@enterprisehrms.com',
      password: 'HR123!',
      role: 'HR Manager',
      employeeProfile: hrEmp._id,
      isActive: true,
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    });
    hrEmp.user = hrUser._id;
    await hrEmp.save();

    // Set HR head
    hrDept.head = hrEmp._id;
    await hrDept.save();

    // Regular Employees data
    const employeesConfig = [
      {
        id: 'EMP-1002',
        firstName: 'Alex',
        lastName: 'Morgan',
        email: 'alex.morgan@enterprisehrms.com',
        phone: '+1 (555) 345-6789',
        gender: 'Male',
        dob: '1992-06-20',
        dept: engineering,
        designation: 'Lead Full Stack Architect',
        joining: '2022-03-15',
        salary: 145000,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      },
      {
        id: 'EMP-1003',
        firstName: 'Sophia',
        lastName: 'Chen',
        email: 'sophia.chen@enterprisehrms.com',
        phone: '+1 (555) 456-7890',
        gender: 'Female',
        dob: '1995-09-12',
        dept: engineering,
        designation: 'Senior Cloud DevOps Engineer',
        joining: '2023-02-01',
        salary: 130000,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      },
      {
        id: 'EMP-1004',
        firstName: 'Marcus',
        lastName: 'Vance',
        email: 'marcus.vance@enterprisehrms.com',
        phone: '+1 (555) 567-8901',
        gender: 'Male',
        dob: '1990-11-28',
        dept: salesDept,
        designation: 'Director of Enterprise Partnerships',
        joining: '2022-06-10',
        salary: 120000,
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      },
      {
        id: 'EMP-1005',
        firstName: 'Emily',
        lastName: 'Watson',
        email: 'emily.watson@enterprisehrms.com',
        phone: '+1 (555) 678-9012',
        gender: 'Female',
        dob: '1996-03-05',
        dept: productDept,
        designation: 'Lead Product Designer (UI/UX)',
        joining: '2023-05-18',
        salary: 110000,
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      },
      {
        id: 'EMP-1006',
        firstName: 'David',
        lastName: 'Kim',
        email: 'david.kim@enterprisehrms.com',
        phone: '+1 (555) 789-0123',
        gender: 'Male',
        dob: '1989-12-19',
        dept: financeDept,
        designation: 'Senior Financial Analyst',
        joining: '2021-08-01',
        salary: 105000,
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      },
    ];

    const createdEmployees = [hrEmp];

    for (const conf of employeesConfig) {
      const emp = await Employee.create({
        employeeId: conf.id,
        firstName: conf.firstName,
        lastName: conf.lastName,
        fullName: `${conf.firstName} ${conf.lastName}`,
        email: conf.email,
        phone: conf.phone,
        address: {
          street: '100 Innovation Way',
          city: 'San Francisco',
          state: 'CA',
          country: 'USA',
          zipCode: '94105',
        },
        gender: conf.gender,
        dateOfBirth: new Date(conf.dob),
        department: conf.dept._id,
        designation: conf.designation,
        joiningDate: new Date(conf.joining),
        salary: conf.salary,
        status: 'Active',
        profilePhoto: conf.avatar,
        emergencyContact: {
          name: 'Contact ' + conf.lastName,
          relationship: 'Family',
          phone: conf.phone,
        },
        bankDetails: {
          accountName: `${conf.firstName} ${conf.lastName}`,
          accountNumber: `4567890123${conf.id.slice(-2)}`,
          bankName: 'Global Enterprise Bank',
          routingOrIfsc: 'GEB000491',
        },
        leaveBalance: {
          casualLeave: 11,
          sickLeave: 9,
          earnedLeave: 15,
          workFromHome: 20,
        },
        documents: [
          {
            name: 'Offer_Letter.pdf',
            fileUrl: '/uploads/sample_offer_letter.pdf',
            fileType: 'pdf',
            uploadedAt: new Date(conf.joining),
          },
          {
            name: 'ID_Verification.pdf',
            fileUrl: '/uploads/sample_id_proof.pdf',
            fileType: 'pdf',
            uploadedAt: new Date(conf.joining),
          },
        ],
      });

      const user = await User.create({
        name: `${conf.firstName} ${conf.lastName}`,
        email: conf.email,
        password: 'Emp123!',
        role: 'Employee',
        employeeProfile: emp._id,
        isActive: true,
        avatar: conf.avatar,
      });

      emp.user = user._id;
      await emp.save();
      createdEmployees.push(emp);
    }

    // Set heads
    engineering.head = createdEmployees[1]._id; // Alex Morgan
    await engineering.save();
    salesDept.head = createdEmployees[3]._id; // Marcus Vance
    await salesDept.save();
    financeDept.head = createdEmployees[5]._id; // David Kim
    await financeDept.save();
    productDept.head = createdEmployees[4]._id; // Emily Watson
    await productDept.save();

    console.log(`[Seeder] Created ${createdEmployees.length} employees and users`);

    // 3. Generate Past 30 Days of Attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
      const recordDate = new Date(today);
      recordDate.setDate(recordDate.getDate() - dayOffset);

      // Skip weekends (Saturday=6, Sunday=0)
      const dayOfWeek = recordDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      for (const emp of createdEmployees) {
        // Randomize attendance
        const rand = Math.random();
        let status = 'Present';
        let checkInHour = 8 + Math.floor(Math.random() * 2); // 8 or 9
        let checkInMinute = Math.floor(Math.random() * 59);

        if (checkInHour === 9 && checkInMinute > 30) {
          status = 'Late';
        }

        if (rand < 0.05) {
          status = 'On Leave';
        } else if (rand < 0.08) {
          status = 'Absent';
        }

        const checkIn = new Date(recordDate);
        checkIn.setHours(checkInHour, checkInMinute, 0);

        const checkOut = new Date(recordDate);
        checkOut.setHours(17 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 45), 0);

        const hours = status === 'Present' || status === 'Late'
          ? Math.round(((checkOut - checkIn) / (1000 * 60 * 60)) * 10) / 10
          : 0;

        await Attendance.create({
          employee: emp._id,
          date: recordDate,
          checkIn: status === 'Absent' || status === 'On Leave' ? null : checkIn,
          checkOut: status === 'Absent' || status === 'On Leave' ? null : checkOut,
          workingHours: hours,
          status,
          notes: status === 'Late' ? 'Traffic delay on highway 101' : '',
          location: 'Office',
        });
      }
    }
    console.log('[Seeder] Generated realistic attendance records for past 30 days');

    // 4. Generate Leave Requests
    const leaveTypes = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Work From Home'];
    await LeaveRequest.create([
      {
        employee: createdEmployees[1]._id, // Alex Morgan
        leaveType: 'Work From Home',
        startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        days: 2,
        reason: 'Focusing on database optimization and architecture refactor',
        status: 'Pending',
      },
      {
        employee: createdEmployees[2]._id, // Sophia Chen
        leaveType: 'Casual Leave',
        startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        days: 3,
        reason: 'Attending family anniversary out of state',
        status: 'Pending',
      },
      {
        employee: createdEmployees[3]._id, // Marcus Vance
        leaveType: 'Sick Leave',
        startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        days: 2,
        reason: 'Severe seasonal flu symptoms and doctor visit',
        status: 'Approved',
        reviewedBy: hrUser._id,
        reviewedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        comments: 'Get well soon!',
      },
      {
        employee: createdEmployees[4]._id, // Emily Watson
        leaveType: 'Earned Leave',
        startDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        days: 5,
        reason: 'Annual family retreat',
        status: 'Approved',
        reviewedBy: hrUser._id,
        reviewedAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000),
      },
    ]);
    console.log('[Seeder] Created leave requests');

    // 5. Generate Payroll Records for recent months
    const currentYear = today.getFullYear();
    const monthsToSeed = [
      { month: 1, label: 'January' },
      { month: 2, label: 'February' },
      { month: 3, label: 'March' },
    ];

    for (const m of monthsToSeed) {
      for (const emp of createdEmployees) {
        const monthlyGross = Math.round(emp.salary / 12);
        const basic = Math.round(monthlyGross * 0.50);
        const hra = Math.round(monthlyGross * 0.20);
        const allowances = Math.round(monthlyGross * 0.20);
        const bonus = m.month === 3 ? 1500 : 0;
        const gross = basic + hra + allowances + bonus;
        const tax = Math.round(gross * 0.10);
        const pf = Math.round(basic * 0.12);
        const totalDeductions = tax + pf;
        const net = gross - totalDeductions;

        await Payroll.create({
          employee: emp._id,
          month: m.month,
          year: currentYear,
          payPeriod: `${m.label} ${currentYear}`,
          basicSalary: basic,
          hra: hra,
          allowances: allowances,
          bonus: bonus,
          grossEarnings: gross,
          taxDeduction: tax,
          pfDeduction: pf,
          totalDeductions: totalDeductions,
          netSalary: net,
          paymentStatus: m.month <= 2 ? 'Paid' : 'Pending',
          paymentDate: m.month <= 2 ? new Date(currentYear, m.month, 1) : null,
          paymentMethod: 'Bank Transfer',
        });
      }
    }
    console.log('[Seeder] Created payroll records for Q1');

    // 6. Generate Performance Reviews
    await PerformanceReview.create([
      {
        employee: createdEmployees[1]._id, // Alex Morgan
        reviewer: hrUser._id,
        reviewPeriod: 'Annual Review 2025',
        rating: 5,
        metrics: {
          technicalSkills: 5,
          communication: 4,
          leadership: 5,
          punctuality: 5,
          workQuality: 5,
        },
        goals: [
          {
            title: 'Lead Cloud Architecture Migration',
            description: 'Transition microservices to modern serverless infrastructure',
            status: 'Completed',
            progress: 100,
          },
          {
            title: 'Mentor 3 Junior Engineers',
            description: 'Weekly 1:1 code pairing sessions',
            status: 'In Progress',
            progress: 75,
          },
        ],
        strengths: 'Exceptional system architecture skills, strong mentorship, and always reliable under tight deadlines.',
        areasForImprovement: 'Delegate lower-level operational duties to team leads.',
        feedback: 'Alex continues to be a cornerstone of our enterprise software engineering division.',
        status: 'Approved',
      },
      {
        employee: createdEmployees[2]._id, // Sophia Chen
        reviewer: hrUser._id,
        reviewPeriod: 'Q4 2025 Review',
        rating: 4,
        metrics: {
          technicalSkills: 5,
          communication: 4,
          leadership: 4,
          punctuality: 4,
          workQuality: 4,
        },
        goals: [
          {
            title: 'Kubernetes Cluster Hardening',
            description: 'Implement zero-trust network policies and secrets rotation',
            status: 'Completed',
            progress: 100,
          },
        ],
        strengths: 'Deep knowledge of container orchestration, proactive incident mitigation.',
        areasForImprovement: 'Expand cross-departmental documentation.',
        feedback: 'Great work maintaining 99.99% system uptime throughout the holiday surge.',
        status: 'Approved',
      },
    ]);
    console.log('[Seeder] Created performance reviews');

    // 7. Generate Real Notifications
    await Notification.create([
      {
        recipient: adminUser._id,
        targetRole: 'Super Admin',
        title: 'System Health Check Passed',
        message: 'All 8 database clusters and real-time socket channels are healthy and optimal.',
        type: 'system',
        link: '/audit',
      },
      {
        recipient: hrUser._id,
        targetRole: 'HR Manager',
        title: 'New Leave Request Awaiting Review',
        message: 'Alex Morgan submitted a Work From Home application for 2 days.',
        type: 'leave',
        link: '/leaves',
      },
      {
        recipient: createdEmployees[1].user,
        targetRole: 'Employee',
        title: 'March 2026 Payslip Available',
        message: 'Your salary statement for March 2026 is generated and ready for PDF download.',
        type: 'payroll',
        link: '/payroll',
      },
      {
        targetRole: 'All',
        title: 'Enterprise All-Hands Meeting',
        message: 'Quarterly Townhall scheduled for this Friday at 3:00 PM EST via Main Auditorium.',
        type: 'info',
        link: '/dashboard',
      },
    ]);
    console.log('[Seeder] Created notifications');

    // 8. Generate Audit Logs
    await AuditLog.create([
      {
        user: adminUser._id,
        userName: adminUser.name,
        userRole: adminUser.role,
        action: 'SYSTEM_INITIALIZATION',
        module: 'System',
        details: { message: 'Enterprise HRMS production instance configured' },
        ipAddress: '127.0.0.1',
      },
      {
        user: hrUser._id,
        userName: hrUser.name,
        userRole: hrUser.role,
        action: 'GENERATE_PAYROLL_BATCH',
        module: 'Payroll',
        details: { payPeriod: `March ${currentYear}`, count: 6 },
        ipAddress: '192.168.1.105',
      },
      {
        user: hrUser._id,
        userName: hrUser.name,
        userRole: hrUser.role,
        action: 'APPROVE_LEAVE',
        module: 'Leave',
        details: { employee: 'Marcus Vance', days: 2, leaveType: 'Sick Leave' },
        ipAddress: '192.168.1.105',
      },
      {
        user: adminUser._id,
        userName: adminUser.name,
        userRole: adminUser.role,
        action: 'LOGIN',
        module: 'Auth',
        details: { email: 'admin@enterprisehrms.com' },
        ipAddress: '127.0.0.1',
      },
    ]);
    console.log('[Seeder] Created audit logs');

    console.log('\n======================================================');
    console.log(' DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('======================================================');
    console.log('Ready-to-use Accounts:');
    console.log('  1. Super Admin: admin@enterprisehrms.com       / Admin123!');
    console.log('  2. HR Manager:  hrmanager@enterprisehrms.com   / HR123!');
    console.log('  3. Employee:    alex.morgan@enterprisehrms.com / Emp123!');
    console.log('                  sophia.chen@enterprisehrms.com / Emp123!');
    console.log('======================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('[Seeder Error]', error);
    process.exit(1);
  }
};

seedData();
