import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';

export const emailTemplateController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pool.query('SELECT * FROM email_templates ORDER BY id ASC');
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM email_templates WHERE id = $1', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { name, subject, body } = req.body;
      
      await pool.query(
        'UPDATE email_templates SET name = $1, subject = $2, body = $3, updated_at = NOW() WHERE id = $4',
        [name, subject, body, id]
      );
      
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
};
