import { Router } from 'express';
import { userController } from '../controllers/userController';
import { authorize } from '../middleware/auth';

const router = Router();

router.get('/', authorize(['manage_users']), userController.getAll);
router.post('/', authorize(['manage_users']), userController.create);
router.patch('/:id', authorize(['manage_users']), userController.update);
router.delete('/:id', authorize(['manage_users']), userController.delete);

export default router;
