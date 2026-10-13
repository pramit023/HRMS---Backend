const XLSX = require('xlsx');

/**
 * Generate Excel workbook buffer from JSON data
 */
const exportToExcelBuffer = (data, sheetName = 'Report') => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
};

module.exports = {
  exportToExcelBuffer,
};
