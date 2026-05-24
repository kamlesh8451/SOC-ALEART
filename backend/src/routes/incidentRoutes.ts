import { Router } from 'express';
import { incidentController } from '../controllers/incidentController';

const router = Router();

router.get('/', incidentController.getAll);
router.get('/export', incidentController.exportAll);
router.post('/import', incidentController.importCsv);
router.get('/stats', incidentController.getStats);
router.get('/analytics', incidentController.getAnalytics);
router.get('/search', incidentController.search);
router.post('/merge', incidentController.merge);
router.get('/:id', incidentController.getOne);
router.post('/:id/syric', incidentController.startSyric);
router.post('/', incidentController.create);
router.get('/:id/export', incidentController.exportOne);
router.patch('/:id', incidentController.update);
router.delete('/:id', incidentController.delete);
router.delete('/bulk', incidentController.bulkDelete);
router.patch('/bulk/status', incidentController.bulkUpdateStatus);
router.get('/:id/related', incidentController.getRelated);

export default router;
