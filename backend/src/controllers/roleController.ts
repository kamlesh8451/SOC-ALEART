import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';
import { v4 as uuidv4 } from 'uuid';

export const roleController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pool.query("SELECT * FROM roles");
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { id = uuidv4(), name, permissions, description } = req.body;
      await pool.query(
        "INSERT INTO roles (id, name, permissions, description) VALUES ($1, $2, $3, $4)",
        [id, name, permissions, description]
      );
      res.json({ id, name });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { name, permissions, description } = req.body;
      await pool.query(
        "UPDATE roles SET name = COALESCE($1, name), permissions = COALESCE($2, permissions), description = COALESCE($3, description) WHERE id = $4",
        [name, permissions, description, id]
      );
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await pool.query("DELETE FROM roles WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
};
