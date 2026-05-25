import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';

export const notificationController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      console.log(`[DEBUG] Fetching notifications for user: ${userId}`);
      
      if (!userId) {
        console.warn('[DEBUG] No user ID found in request for notifications');
        return res.status(401).json({ error: 'Unauthorized: Missing User ID' });
      }

      const result = await pool.query(
        'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
        [userId]
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      await pool.query(
        'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      await pool.query(
        'UPDATE notifications SET read = TRUE WHERE user_id = $1',
        [userId]
      );
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      await pool.query(
        'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
};
