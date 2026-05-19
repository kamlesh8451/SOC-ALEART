import { Router } from 'express';
import { ruleController } from '../controllers/ruleController';

const router = Router();

router.get('/', ruleController.getAll);
router.post('/', ruleController.create);
router.patch('/:id', ruleController.update);
router.delete('/:id', ruleController.delete);

export default router;
