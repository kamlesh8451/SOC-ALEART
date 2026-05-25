import { Router } from 'express';
import { emailTemplateController } from '../controllers/emailTemplateController';
import { authorize } from '../middleware/auth';

const router = Router();

router.get('/', authorize(['manage_rules']), emailTemplateController.getAll);
router.get('/:id', authorize(['manage_rules']), emailTemplateController.getById);
router.patch('/:id', authorize(['manage_rules']), emailTemplateController.update);

export default router;
