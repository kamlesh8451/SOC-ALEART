import { Router } from 'express';
import { auditController } from '../controllers/auditController';

const router = Router();

router.get('/', auditController.getAll);

export default router;
