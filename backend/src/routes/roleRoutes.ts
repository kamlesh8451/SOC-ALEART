import { Router } from 'express';
import { roleController } from '../controllers/roleController';

const router = Router();

router.get('/', roleController.getAll);
router.post('/', roleController.create);
router.patch('/:id', roleController.update);
router.delete('/:id', roleController.delete);

export default router;
