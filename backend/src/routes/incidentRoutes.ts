import { Router } from 'express';
import { incidentController } from '../controllers/incidentController';

const router = Router();

router.get('/', incidentController.getAll);
router.post('/', incidentController.create);
router.patch('/:id', incidentController.update);
router.get('/:id/related', incidentController.getRelated);

export default router;
