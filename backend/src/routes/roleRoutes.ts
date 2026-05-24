import { Router } from 'express';
import { roleController } from '../controllers/roleController';
import { authorize } from '../middleware/auth';

const router = Router();

router.get('/', authorize(['manage_users']), roleController.getAll);
router.post('/', authorize(['manage_users']), roleController.create);
router.patch('/:id', authorize(['manage_users']), roleController.update);
router.delete('/:id', authorize(['manage_users']), roleController.delete);

export default router;
