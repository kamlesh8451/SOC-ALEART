import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);
router.get('/sessions', authenticate, authorize(['manage_users']), authController.getSessions);
router.delete('/sessions/:id', authenticate, authorize(['manage_users']), authController.revokeSession);

export default router;
