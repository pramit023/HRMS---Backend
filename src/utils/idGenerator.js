const Employee = require('../models/Employee');

/**
 * Generate next sequential Employee ID (EMP0001, EMP0002, etc.)
 */
const generateNextEmployeeId = async () => {
  // Find all employees with EMP-style IDs to determine highest counter
  const employees = await Employee.find({ employeeId: { $regex: /^EMP\d+$/i } })
    .select('employeeId')
    .lean();

  let maxNumber = 0;
  employees.forEach((emp) => {
    const match = emp.employeeId.match(/^EMP(\d+)$/i);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  });

  const nextNumber = maxNumber + 1;
  return `EMP${String(nextNumber).padStart(4, '0')}`;
};

module.exports = {
  generateNextEmployeeId,
};
