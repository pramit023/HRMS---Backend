const express = require('express');
const router = express.Router();
const {
  getDocuments,
  uploadDocument,
  downloadDocument,
  verifyDocument,
  deleteDocument,
} = require('../controllers/documentController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

router.get('/', getDocuments);
router.post('/upload', upload.single('file'), uploadDocument);
router.get('/:id/download', downloadDocument);
router.patch(
  '/:id/verify',
  authorize('Super Admin', 'HR Admin', 'HR Manager'),
  verifyDocument
);
router.delete('/:id', deleteDocument);

module.exports = router;
