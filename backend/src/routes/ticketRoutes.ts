import { Router } from 'express';
import multer from 'multer';
import { ticketController } from '../controllers/ticketController';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'));
  },
});

router.post('/upload-evidence', upload.single('file'), ticketController.uploadEvidence);
router.post('/confirm-action', ticketController.confirmAction);
router.get('/confirm-action', ticketController.confirmActionLink);

export default router;
