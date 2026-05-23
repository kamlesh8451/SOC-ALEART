import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db';
import { auditService } from '../services/auditService';

const getDirname = () => {
  try {
    if (typeof __dirname !== 'undefined') return __dirname;
    return path.dirname(fileURLToPath(import.meta.url));
  } catch (e) {
    return process.cwd();
  }
};

const _dirname = getDirname();
const uploadsDir = path.resolve(_dirname, '../../uploads');

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export const ticketController = {
  async uploadEvidence(req: Request, res: Response, next: NextFunction) {
    try {
      const { ticketId } = req.body;
      const file = req.file;

      if (!ticketId || !file) {
        return res.status(400).json({ error: 'Ticket ID and file required' });
      }

      if (!ALLOWED_MIME.has(file.mimetype)) {
        return res.status(400).json({
          error: 'Invalid file type. Allowed: PNG, JPG, PDF, TXT, CSV, Excel',
        });
      }

      const ext = path.extname(file.originalname) || '.bin';
      const filename = `${ticketId}-${Date.now()}${ext}`;
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, file.buffer);

      const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3001}`;
      const evidenceUrl = `${baseUrl}/uploads/${filename}`;

      await pool.query(
        'UPDATE incidents SET evidence_url = $1, updated_at = NOW() WHERE id = $2',
        [evidenceUrl, ticketId]
      );

      await auditService.logAction(
        'UPLOAD_EVIDENCE',
        ticketId,
        undefined,
        `File: ${file.originalname} (${file.mimetype})`,
        req.headers['x-user-id'] as string
      );

      res.json({ success: true, url: evidenceUrl });
    } catch (err) {
      next(err);
    }
  },

  async confirmAction(req: Request, res: Response, next: NextFunction) {
    try {
      const { ticketId, action, evidence, role } = req.body;
      const userRole =
        (req.headers['x-user-role'] as string) || role || 'soc_analyst';

      if (action === 'ESCALATE' && userRole !== 'soc_lead' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Only SOC Lead or Admin can escalate incidents' });
      }

      if (!ticketId || !action) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await pool.query('SELECT * FROM incidents WHERE id = $1', [ticketId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Incident not found' });
      }
      const incident = result.rows[0];

      if (action === 'CONFIRM_CLOSED') {
        const evidenceValue = evidence || incident.evidence_url;
        if (!evidenceValue) {
          return res.status(400).json({ error: 'Evidence is required to close the ticket' });
        }
        await pool.query(
          "UPDATE incidents SET status = 'closed', evidence_url = $1, updated_at = NOW() WHERE id = $2",
          [evidenceValue, ticketId]
        );
      } else if (action === 'REQUEST_EXTENSION') {
        await pool.query(
          'UPDATE incidents SET extension_requested = TRUE, extension_reason = $1, updated_at = NOW() WHERE id = $2',
          [evidence || 'Extension requested', ticketId]
        );
      } else if (action === 'ESCALATE') {
        const history = incident.escalation_history || [];
        history.push({
          reason: evidence || 'Escalated via API',
          timestamp: Date.now(),
          userId: userRole,
          userName: userRole === 'soc_lead' ? 'SOC Lead' : 'Command Operative',
        });
        await pool.query(
          "UPDATE incidents SET status = 'escalated', escalation_history = $1, updated_at = NOW() WHERE id = $2",
          [JSON.stringify(history), ticketId]
        );
      }

      await auditService.logAction(
        action,
        ticketId,
        incident.ticket_number,
        `Action via API. Detail: ${evidence || 'N/A'}`,
        userRole
      );

      res.json({ success: true, message: `Action ${action} processed successfully` });
    } catch (err) {
      next(err);
    }
  },

  async confirmActionLink(req: Request, res: Response, next: NextFunction) {
    const { ticketId, action, reason } = req.query;

    if (!ticketId || !action) {
      return res.status(400).send('<h1>Error</h1><p>Missing parameters.</p>');
    }

    try {
      const result = await pool.query('SELECT * FROM incidents WHERE id = $1', [ticketId]);
      if (result.rows.length === 0) {
        return res.status(404).send('<h1>Error</h1><p>Incident not found.</p>');
      }
      const incident = result.rows[0];
      let successMessage = 'Action registered and synchronized.';

      if (action === 'CONFIRM_CLOSED') {
        if (!incident.evidence_url) {
          return res
            .status(400)
            .send(
              '<h1>Evidence Required</h1><p>Upload evidence in the dashboard before confirming closure via email.</p>'
            );
        }
        await pool.query(
          "UPDATE incidents SET status = 'closed', updated_at = NOW() WHERE id = $1",
          [ticketId]
        );
        await auditService.logAction(
          'CONFIRM_CLOSED_EMAIL',
          ticketId as string,
          incident.ticket_number,
          'Closed via email link'
        );
        successMessage = 'Incident closed successfully.';
      } else if (action === 'NOT_CLOSED') {
        await auditService.logAction(
          'ACK_NOT_CLOSED',
          ticketId as string,
          incident.ticket_number,
          'Acknowledged still open via email'
        );
        successMessage = 'Incident status confirmed as OPEN.';
      } else if (action === 'REQUEST_EXTENSION') {
        await pool.query(
          'UPDATE incidents SET extension_requested = TRUE, extension_reason = $1, updated_at = NOW() WHERE id = $2',
          [(reason as string) || 'Requested via email link', ticketId]
        );
        await auditService.logAction(
          'REQUEST_EXTENSION_EMAIL',
          ticketId as string,
          incident.ticket_number,
          `Extension via email: ${reason || 'Not specified'}`
        );
        successMessage = 'SLA extension request submitted.';
      }

      const dashboard = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.send(`
        <html>
          <body style="font-family: Inter, sans-serif; text-align: center; padding: 48px; background: #0f0f0f; color: #eee;">
            <div style="max-width:480px;margin:0 auto;padding:32px;border:1px solid #333;border-radius:8px;background:#1a1a1a;">
              <h2>SOC Action Logged</h2>
              <p style="color:#4ade80;font-weight:bold;">${successMessage}</p>
              <p>Ticket: <b>${incident.ticket_number}</b></p>
              <p><a href="${dashboard}" style="color:#60a5fa;">Return to GuardianSOC Dashboard</a></p>
            </div>
          </body>
        </html>
      `);
    } catch (err) {
      next(err);
    }
  },
};
