const PDFDocument = require('pdfkit');

/**
 * Generate Payslip PDF stream
 */
const generatePayslipPDF = (payroll, employee, department) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  // Header
  doc
    .fillColor('#1e293b')
    .fontSize(22)
    .font('Helvetica-Bold')
    .text('NEXUS ENTERPRISE HRMS', 40, 45);

  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#64748b')
    .text('Global Corporate Tower, 500 Tech Blvd, Suite 800', 40, 72)
    .text('Email: payroll@nexushrms.internal | Phone: +1 (800) 555-0199', 40, 86);

  doc
    .fontSize(16)
    .font('Helvetica-Bold')
    .fillColor('#0284c7')
    .text('SALARY SLIP / PAYSLIP', 40, 115, { align: 'right' });

  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#475569')
    .text(`Pay Period: ${payroll.payPeriod}`, 40, 135, { align: 'right' })
    .text(`Payment Status: ${payroll.paymentStatus.toUpperCase()}`, 40, 150, { align: 'right' });

  // Divider line
  doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, 175).lineTo(555, 175).stroke();

  // Employee details card background
  doc.rect(40, 185, 515, 80).fillColor('#f8fafc').fill();
  doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(40, 185, 515, 80).stroke();

  // Employee info text
  doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold');
  doc.text(`Employee Name:`, 55, 198);
  doc.font('Helvetica').text(`${employee.fullName || employee.firstName + ' ' + employee.lastName}`, 160, 198);

  doc.font('Helvetica-Bold').text(`Employee ID:`, 55, 218);
  doc.font('Helvetica').text(`${employee.employeeId}`, 160, 218);

  doc.font('Helvetica-Bold').text(`Department:`, 55, 238);
  doc.font('Helvetica').text(`${department ? department.name : 'General'}`, 160, 238);

  doc.font('Helvetica-Bold').text(`Designation:`, 320, 198);
  doc.font('Helvetica').text(`${employee.designation}`, 410, 198);

  doc.font('Helvetica-Bold').text(`Bank Name:`, 320, 218);
  doc.font('Helvetica').text(`${employee.bankDetails?.bankName || 'Direct Transfer'}`, 410, 218);

  doc.font('Helvetica-Bold').text(`Account No:`, 320, 238);
  doc.font('Helvetica').text(`${employee.bankDetails?.accountNumber || '••••••••1234'}`, 410, 238);

  // Earnings & Deductions Tables side-by-side
  const tableTop = 285;

  // Earnings Header
  doc.rect(40, tableTop, 250, 24).fillColor('#0284c7').fill();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10).text('EARNINGS', 50, tableTop + 7);
  doc.text('AMOUNT ($)', 210, tableTop + 7);

  // Deductions Header
  doc.rect(305, tableTop, 250, 24).fillColor('#ef4444').fill();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10).text('DEDUCTIONS', 315, tableTop + 7);
  doc.text('AMOUNT ($)', 475, tableTop + 7);

  // Table items
  const earnings = [
    { label: 'Basic Salary', val: payroll.basicSalary },
    { label: 'House Rent Allowance (HRA)', val: payroll.hra },
    { label: 'Special & Other Allowances', val: payroll.allowances },
    { label: 'Performance Bonus', val: payroll.bonus },
  ];

  const deductions = [
    { label: 'Income Tax (TDS / PAYE)', val: payroll.taxDeduction },
    { label: 'Provident Fund (PF / 401k)', val: payroll.pfDeduction },
    { label: 'Other Deductions / Leaves', val: payroll.otherDeductions },
  ];

  let currentY = tableTop + 30;

  for (let i = 0; i < Math.max(earnings.length, deductions.length); i++) {
    // Earnings side
    if (earnings[i]) {
      doc.fillColor('#334155').font('Helvetica').fontSize(9).text(earnings[i].label, 50, currentY);
      doc.font('Helvetica-Bold').text(`$${earnings[i].val.toLocaleString()}`, 210, currentY);
    }
    // Deductions side
    if (deductions[i]) {
      doc.fillColor('#334155').font('Helvetica').fontSize(9).text(deductions[i].label, 315, currentY);
      doc.font('Helvetica-Bold').text(`$${deductions[i].val.toLocaleString()}`, 475, currentY);
    }

    doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(40, currentY + 16).lineTo(290, currentY + 16).stroke();
    doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(305, currentY + 16).lineTo(555, currentY + 16).stroke();

    currentY += 24;
  }

  // Totals Row
  currentY += 10;
  doc.rect(40, currentY, 250, 26).fillColor('#f0f9ff').fill();
  doc.strokeColor('#bae6fd').rect(40, currentY, 250, 26).stroke();
  doc.fillColor('#0369a1').font('Helvetica-Bold').fontSize(10).text('Total Earnings:', 50, currentY + 8);
  doc.text(`$${payroll.grossEarnings.toLocaleString()}`, 200, currentY + 8);

  doc.rect(305, currentY, 250, 26).fillColor('#fef2f2').fill();
  doc.strokeColor('#fecaca').rect(305, currentY, 250, 26).stroke();
  doc.fillColor('#b91c1c').font('Helvetica-Bold').fontSize(10).text('Total Deductions:', 315, currentY + 8);
  doc.text(`$${payroll.totalDeductions.toLocaleString()}`, 465, currentY + 8);

  // Net Salary Box
  currentY += 45;
  doc.rect(40, currentY, 515, 55).fillColor('#0f172a').fill();
  doc.fillColor('#94a3b8').font('Helvetica').fontSize(10).text('NET SALARY PAYABLE', 60, currentY + 12);
  doc
    .fillColor('#38bdf8')
    .font('Helvetica-Bold')
    .fontSize(22)
    .text(`$${payroll.netSalary.toLocaleString()}`, 60, currentY + 26);

  doc
    .fillColor('#cbd5e1')
    .fontSize(9)
    .font('Helvetica')
    .text(`Disbursed via ${payroll.paymentMethod}`, 380, currentY + 22, { align: 'right' });

  // Notes and Signatures
  currentY += 90;
  doc
    .fillColor('#64748b')
    .fontSize(9)
    .font('Helvetica')
    .text('Note: This is a system-generated digital payslip and requires no physical signature.', 40, currentY);

  currentY += 40;
  doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, currentY).lineTo(200, currentY).stroke();
  doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(395, currentY).lineTo(555, currentY).stroke();

  doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold').text('Employee Signature', 40, currentY + 8);
  doc.text('Authorized Signatory (HR/Finance)', 395, currentY + 8);

  // End doc
  doc.end();
  return doc;
};

module.exports = {
  generatePayslipPDF,
};
