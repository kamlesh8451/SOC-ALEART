import { Router } from 'express';
import { ruleController } from '../controllers/ruleController';
import { authorize } from '../middleware/auth';

const router = Router();

router.get('/', authorize(['manage_rules']), ruleController.getAll);
router.post('/', authorize(['manage_rules']), ruleController.create);
router.patch('/:id', authorize(['manage_rules']), ruleController.update);
router.delete('/:id', authorize(['manage_rules']), ruleController.delete);

export default router;
