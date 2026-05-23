import { Router } from 'express';
import pool from '../config/db';
import { EmailIngestionService } from '../services/EmailIngestionService';

const router = Router();

// Get mailbox settings
router.get('/settings', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, host, port, ssl, username, poll_interval, is_active FROM mailbox_settings LIMIT 1');
    res.json(result.rows[0] || null);
  } catch (err) {
    next(err);
  }
});

// Update mailbox settings
router.post('/settings', async (req, res, next) => {
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
router.get('/logs', async (req, res, next) => {
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
