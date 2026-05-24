import { Router } from 'express';
import { slaController } from '../controllers/slaController';
import { authorize } from '../middleware/auth';

const router = Router();

router.get('/', slaController.getAll);
router.patch('/:id', authorize(['manage_rules']), slaController.update);

export default router;
