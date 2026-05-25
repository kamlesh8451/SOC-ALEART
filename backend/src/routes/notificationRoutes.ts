import { Router } from 'express';
import { notificationController } from '../controllers/notificationController';
import { buildNotificationEmail } from '../services/notificationService';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', notificationController.getAll);
router.patch('/:id/read', notificationController.markAsRead);
router.post('/read-all', notificationController.markAllAsRead);
router.delete('/:id', notificationController.delete);

router.post('/simulate-email', (req, res) => {
  try {
    const { incident, type } = req.body;
    const email = buildNotificationEmail(incident, type || 'alert');
    res.json(email);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Notification failed';
    res.status(400).json({ error: message });
  }
});

export default router;
