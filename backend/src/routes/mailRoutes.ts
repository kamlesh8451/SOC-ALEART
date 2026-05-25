import { Router } from 'express';
import pool from '../config/db';
import { EmailIngestionService } from '../services/EmailIngestionService';
import { sendReply } from '../services/notificationService';
import { auditService } from '../services/auditService';
import { authorize } from '../middleware/auth';

const router = Router();

// ... existing settings routes ...

router.post('/reply', authorize(['modify_incident']), async (req, res, next) => {
  try {
    const { incidentId, message } = req.body;
    
    // 1. Fetch incident details and metadata
    const result = await pool.query('SELECT * FROM incidents WHERE id = $1', [incidentId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Incident not found' });
    const incident = result.rows[0];

    // 2. Extract recipient and threading info from metadata
    let metadata: any = {};
    try {
      metadata = typeof incident.metadata === 'string' ? JSON.parse(incident.metadata) : (incident.metadata || {});
    } catch (e) {}

    const recipient = metadata.sender || process.env.DEFAULT_ALERT_RECIPIENT;
    const originalMessageId = metadata.messageId;

    if (!recipient) return res.status(400).json({ error: 'No recipient identified for this incident thread' });

    // 3. Send the reply
    await sendReply(incident, message, recipient, originalMessageId);

    // 4. Log the outgoing reply
    await pool.query(
      'INSERT INTO email_logs (message_id, sender, subject, processed_status, incident_id) VALUES ($1, $2, $3, $4, $5)',
      [`reply-${Date.now()}`, 'GuardianSOC Security', `Re: ${incident.alert_name}`, 'SENT', incidentId]
    );

    await auditService.logAction(
      'EMAIL_SENT',
      incidentId,
      incident.ticket_number,
      `Reply sent to ${recipient}`,
      (req as any).user?.id
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Get mailbox settings
router.get('/settings', authorize(['manage_rules']), async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, host, port, ssl, username, poll_interval, is_active, last_sync_at, last_sync_status, last_error FROM mailbox_settings LIMIT 1');
    res.json(result.rows[0] || null);
  } catch (err) {
    next(err);
  }
});

// Update mailbox settings
router.post('/settings', authorize(['manage_rules']), async (req, res, next) => {
  try {
    const { host, port, ssl, username, password, poll_interval, is_active } = req.body;
    
    // Check if settings exist
    const exists = await pool.query('SELECT id FROM mailbox_settings LIMIT 1');
    
    if (exists.rows.length > 0) {
      const id = exists.rows[0].id;
      const query = password 
        ? 'UPDATE mailbox_settings SET host=$1, port=$2, ssl=$3, username=$4, password=$5, poll_interval=$6, is_active=$7 WHERE id=$8'
        : 'UPDATE mailbox_settings SET host=$1, port=$2, ssl=$3, username=$4, poll_interval=$5, is_active=$6 WHERE id=$7';
      
      const params = password 
        ? [host, port, ssl, username, password, poll_interval, is_active, id]
        : [host, port, ssl, username, poll_interval, is_active, id];
      
      await pool.query(query, params);
    } else {
      await pool.query(
        'INSERT INTO mailbox_settings (host, port, ssl, username, password, poll_interval, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [host, port, ssl, username, password, poll_interval, is_active]
      );
    }

    // Restart service with new settings
    EmailIngestionService.start();

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Get email logs
router.get('/logs', authorize(['view_audit_logs']), async (req, res, next) => {
  try {
    const { incidentId } = req.query;
    let query = 'SELECT * FROM email_logs';
    const params = [];

    if (incidentId) {
      query += ' WHERE incident_id = $1';
      params.push(incidentId);
    }

    query += ' ORDER BY received_at DESC LIMIT 100';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;
