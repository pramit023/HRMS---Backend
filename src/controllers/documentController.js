const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const Employee = require('../models/Employee');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { logAudit } = require('../services/auditService');

/**
 * @desc    Get documents with filtering and pagination
 * @route   GET /api/documents
 * @access  Private
 */
const getDocuments = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      documentType = '',
      status = '',
      employeeId = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = {};

    // Role scoping: Employees only view their own documents
    if (req.user.role === 'Employee') {
      if (req.user.employeeProfile) {
        query.employee = req.user.employeeProfile._id;
      } else {
        return successResponse(res, [], 'No employee profile linked', 200, {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        });
      }
    } else if (employeeId) {
      query.employee = employeeId;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { fileName: { $regex: search, $options: 'i' } },
      ];
    }

    if (documentType) {
      query.documentType = documentType;
    }

    if (status) {
      query.status = status;
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const total = await Document.countDocuments(query);
    const documents = await Document.find(query)
      .populate('employee', 'firstName lastName fullName employeeId designation profilePhoto')
      .populate('uploadedBy', 'name email role')
      .populate('verifiedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    return successResponse(res, documents, 'Documents fetched successfully', 200, {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload document
 * @route   POST /api/documents/upload
 * @access  Private
 */
const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'Please select a file to upload', 400);
    }

    const { title, documentType, employee } = req.body;

    let targetEmployeeId = employee;
    if (req.user.role === 'Employee') {
      if (!req.user.employeeProfile) {
        return errorResponse(res, 'No employee profile linked to user', 400);
      }
      targetEmployeeId = req.user.employeeProfile._id;
    }

    if (!targetEmployeeId) {
      return errorResponse(res, 'Target employee is required', 400);
    }

    const emp = await Employee.findById(targetEmployeeId);
    if (!emp) {
      return errorResponse(res, 'Employee not found', 404);
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    const newDoc = await Document.create({
      title: title || req.file.originalname,
      documentType: documentType || 'Other',
      employee: emp._id,
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user._id,
      status: req.user.role === 'Employee' ? 'Pending' : 'Verified',
      verifiedBy: req.user.role !== 'Employee' ? req.user._id : null,
    });

    // Also link in Employee profile documents array
    emp.documents.push({
      name: newDoc.title,
      fileUrl: newDoc.fileUrl,
      fileType: path.extname(req.file.originalname).replace('.', '') || 'pdf',
      uploadedAt: new Date(),
    });
    await emp.save();

    await logAudit({
      req,
      action: 'UPLOAD_DOCUMENT',
      module: 'Document',
      details: { docId: newDoc._id, title: newDoc.title, employeeId: emp.employeeId },
    });

    const populatedDoc = await Document.findById(newDoc._id)
      .populate('employee', 'firstName lastName fullName employeeId')
      .populate('uploadedBy', 'name email');

    return successResponse(res, populatedDoc, 'Document uploaded successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Download document
 * @route   GET /api/documents/:id/download
 * @access  Private
 */
const downloadDocument = async (req, res, next) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return errorResponse(res, 'Document record not found', 404);
    }

    // Role security check
    if (
      req.user.role === 'Employee' &&
      req.user.employeeProfile &&
      doc.employee.toString() !== req.user.employeeProfile._id.toString()
    ) {
      return errorResponse(res, 'Not authorized to download this document', 403);
    }

    const filename = path.basename(doc.fileUrl);
    const filePath = path.join(__dirname, '../../uploads', filename);

    if (!fs.existsSync(filePath)) {
      return errorResponse(res, 'File not found on server storage', 404);
    }

    return res.download(filePath, doc.fileName);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify document status (Admin/HR action)
 * @route   PATCH /api/documents/:id/verify
 * @access  Private (Super Admin, HR Admin, HR Manager)
 */
const verifyDocument = async (req, res, next) => {
  try {
    const { status, verificationNotes } = req.body;

    if (!['Pending', 'Verified', 'Rejected'].includes(status)) {
      return errorResponse(res, 'Invalid status value', 400);
    }

    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return errorResponse(res, 'Document not found', 404);
    }

    doc.status = status;
    doc.verifiedBy = req.user._id;
    if (verificationNotes !== undefined) doc.verificationNotes = verificationNotes;

    await doc.save();

    await logAudit({
      req,
      action: 'VERIFY_DOCUMENT',
      module: 'Document',
      details: { docId: doc._id, title: doc.title, status },
    });

    const updatedDoc = await Document.findById(doc._id)
      .populate('employee', 'firstName lastName fullName employeeId')
      .populate('verifiedBy', 'name email');

    return successResponse(res, updatedDoc, `Document marked as ${status}`);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete document
 * @route   DELETE /api/documents/:id
 * @access  Private
 */
const deleteDocument = async (req, res, next) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return errorResponse(res, 'Document not found', 404);
    }

    // Role check: Employee can only delete pending documents they uploaded
    if (req.user.role === 'Employee') {
      if (
        !req.user.employeeProfile ||
        doc.employee.toString() !== req.user.employeeProfile._id.toString()
      ) {
        return errorResponse(res, 'Not authorized to delete this document', 403);
      }
    }

    // Remove file from disk
    const filename = path.basename(doc.fileUrl);
    const filePath = path.join(__dirname, '../../uploads', filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.warn('Could not remove file from disk:', err.message);
      }
    }

    await Document.findByIdAndDelete(req.params.id);

    await logAudit({
      req,
      action: 'DELETE_DOCUMENT',
      module: 'Document',
      details: { docId: req.params.id, title: doc.title },
    });

    return successResponse(res, null, 'Document deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDocuments,
  uploadDocument,
  downloadDocument,
  verifyDocument,
  deleteDocument,
};
