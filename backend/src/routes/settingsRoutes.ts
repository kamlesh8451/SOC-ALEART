import { Router } from 'express';
import { settingsController } from '../controllers/settingsController';
import { authorize } from '../middleware/auth';

const router = Router();

// Only admins should manage mailbox settings
router.get('/mailbox', authorize(['all']), settingsController.getMailboxSettings);
router.post('/mailbox', authorize(['all']), settingsController.createMailboxSettings);
router.patch('/mailbox/:id', authorize(['all']), settingsController.updateMailboxSettings);

router.get('/features', settingsController.getFeatureFlags);
router.patch('/features/:name', authorize(['all']), settingsController.updateFeatureFlag);

export default router;
