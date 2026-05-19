import { Request, Response } from 'express';
import pool from '../config/db';
import { v4 as uuidv4 } from 'uuid';

export const userController = {
  async getAll(req: Request, res: Response) {
    const result = await pool.query("SELECT * FROM users");
    res.json(result.rows);
  },

  async create(req: Request, res: Response) {
    const { id = uuidv4(), email, name, role, permissions = [] } = req.body;
    await pool.query(
      "INSERT INTO users (id, email, name, role, permissions) VALUES ($1, $2, $3, $4, $5)",
      [id, email, name, role, permissions]
    );
    res.json({ id, email, name, role });
  },

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const { email, name, role, permissions } = req.body;
    await pool.query(
      "UPDATE users SET email = COALESCE($1, email), name = COALESCE($2, name), role = COALESCE($3, role), permissions = COALESCE($4, permissions) WHERE id = $5",
      [email, name, role, permissions, id]
    );
    res.json({ success: true });
  },

  async delete(req: Request, res: Response) {
    await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  }
};
