import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';

export const slaController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pool.query('SELECT * FROM sla_policies ORDER BY response_time_hours ASC');
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { response_time_hours, resolution_time_hours } = req.body;
      
      await pool.query(
        'UPDATE sla_policies SET response_time_hours = $1, resolution_time_hours = $2 WHERE id = $3',
        [response_time_hours, resolution_time_hours, id]
      );
      
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
};
