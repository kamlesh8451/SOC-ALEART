import { Router } from 'express';
import { reportController } from '../controllers/reportController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/handover', authenticate, reportController.getShiftHandoverReport);

export default router;
