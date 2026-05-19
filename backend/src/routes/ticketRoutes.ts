import { Router } from 'express';
import multer from 'multer';
import { ticketController } from '../controllers/ticketController';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

router.post('/upload-evidence', upload.single('file'), ticketController.uploadEvidence);
router.post('/confirm-action', ticketController.confirmAction);
router.get('/confirm-action', ticketController.confirmActionLink);

export default router;
