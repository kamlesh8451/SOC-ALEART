import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';
import { v4 as uuidv4 } from 'uuid';

export const userController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pool.query("SELECT * FROM users");
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { id = uuidv4(), email, name, role, permissions = [] } = req.body;
      await pool.query(
        "INSERT INTO users (id, email, name, role, permissions) VALUES ($1, $2, $3, $4, $5)",
        [id, email, name, role, permissions]
      );
      res.json({ id, email, name, role });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { email, name, role, permissions } = req.body;
      await pool.query(
        "UPDATE users SET email = COALESCE($1, email), name = COALESCE($2, name), role = COALESCE($3, role), permissions = COALESCE($4, permissions) WHERE id = $5",
        [email, name, role, permissions, id]
      );
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // 1. Remove active sessions to prevent foreign key violation
      await pool.query("DELETE FROM sessions WHERE user_id = $1", [id]);
      
      // 2. Clear assignment rules and incident links (Soft-detach)
      await pool.query("UPDATE assignment_rules SET assigned_to_user_id = NULL, assigned_to_user_name = 'Unassigned' WHERE assigned_to_user_id = $1", [id]);
      await pool.query("UPDATE incidents SET assigned_to_user_id = NULL, owner_id = 'unassigned' WHERE assigned_to_user_id = $1 OR owner_id = $1", [id]);

      // 3. Delete the user
      await pool.query("DELETE FROM users WHERE id = $1", [id]);
      
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
};
