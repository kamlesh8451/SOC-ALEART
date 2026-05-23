import { Router } from 'express';
import { reportController } from '../controllers/reportController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/handover', authenticate, reportController.getShiftHandoverReport);

// Intelligence Hub Preview Data
router.get('/executive-data', authenticate, reportController.getExecutiveSummaryData);
router.get('/sla-data', authenticate, reportController.getSlaComplianceData);
router.get('/threat-intel-data', authenticate, reportController.getThreatIntelData);

// Intelligence Hub PDF Exports
router.get('/executive-pdf', authenticate, reportController.generateExecutiveReportPdf);
router.get('/sla-pdf', authenticate, reportController.generateSlaReportPdf);
router.get('/threat-intel-pdf', authenticate, reportController.generateThreatIntelPdf);

export default router;
