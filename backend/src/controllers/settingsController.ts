import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';
import { auditService } from '../services/auditService';

export const settingsController = {
  async getMailboxSettings(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pool.query('SELECT id, host, port, ssl, username, poll_interval, is_active FROM mailbox_settings');
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  async updateMailboxSettings(req: Request, res: Response, next: NextFunction) {
    try {
      let { id } = req.params;
      const { host, port, ssl, username, password, poll_interval, is_active } = req.body;

      // If no ID is provided, try to find the first mailbox
      if (!id || id === 'undefined' || id === 'null') {
        const first = await pool.query('SELECT id FROM mailbox_settings LIMIT 1');
        if (first.rows.length > 0) {
          id = first.rows[0].id;
        } else {
          // If none exists, we should probably create one or return error
          return res.status(404).json({ error: 'No mailbox settings found to update' });
        }
      }

      const fields: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      if (host) { fields.push(`host = $${i++}`); values.push(host); }
      if (port !== undefined) { fields.push(`port = $${i++}`); values.push(port); }
      if (ssl !== undefined) { fields.push(`ssl = $${i++}`); values.push(ssl); }
      if (username) { fields.push(`username = $${i++}`); values.push(username); }
      // Only update password if a non-empty string is provided
      if (password && password.trim().length > 0) { 
        fields.push(`password = $${i++}`); 
        values.push(password); 
      }
      if (poll_interval !== undefined) { fields.push(`poll_interval = $${i++}`); values.push(poll_interval); }
      if (is_active !== undefined) { fields.push(`is_active = $${i++}`); values.push(is_active); }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(id);
      const query = `UPDATE mailbox_settings SET ${fields.join(', ')} WHERE id = $${i}`;
      
      await pool.query(query, values);

      await auditService.logAction(
        'UPDATE_MAILBOX_SETTINGS',
        undefined,
        undefined,
        `Updated mailbox ID: ${id}, user: ${username || 'N/A'}`,
        'system' // In a real app, use req.user.id
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async createMailboxSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { host, port, ssl, username, password, poll_interval, is_active } = req.body;

      const result = await pool.query(
        `INSERT INTO mailbox_settings (host, port, ssl, username, password, poll_interval, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [host, port, ssl || true, username, password, poll_interval || 60, is_active !== undefined ? is_active : true]
      );

      await auditService.logAction(
        'CREATE_MAILBOX_SETTINGS',
        undefined,
        undefined,
        `Created mailbox for: ${username}`,
        req.headers['x-user-id'] as string
      );

      res.status(201).json({ id: result.rows[0].id });
    } catch (err) {
      next(err);
    }
  },

  async getFeatureFlags(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pool.query('SELECT name, is_enabled, description FROM feature_flags');
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  async updateFeatureFlag(req: Request, res: Response, next: NextFunction) {
    try {
      const { name } = req.params;
      const { isEnabled } = req.body;

      await pool.query(
        'UPDATE feature_flags SET is_enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE name = $2',
        [isEnabled, name]
      );

      await auditService.logAction(
        'UPDATE_FEATURE_FLAG',
        undefined,
        undefined,
        `Set feature ${name} to ${isEnabled}`,
        req.headers['x-user-id'] as string
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
};
