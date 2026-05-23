import { Router } from 'express';
import { incidentController } from '../controllers/incidentController';

const router = Router();

router.get('/', incidentController.getAll);
router.get('/export', incidentController.exportAll);
router.post('/import', incidentController.importCsv);
router.get('/stats', incidentController.getStats);
router.post('/', incidentController.create);
router.get('/:id/export', incidentController.exportOne);
router.patch('/:id', incidentController.update);
router.get('/:id/related', incidentController.getRelated);

export default router;
