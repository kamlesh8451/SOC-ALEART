import { Request, Response } from 'express';
import pool from '../config/db';
import { v4 as uuidv4 } from 'uuid';

export const ruleController = {
  async getAll(req: Request, res: Response) {
    const result = await pool.query("SELECT * FROM assignment_rules ORDER BY priority DESC");
    const rules = result.rows.map(row => ({
      id: row.id,
      keyword: row.keyword,
      assignedToUserId: row.assigned_to_user_id,
      assignedToUserName: row.assigned_to_user_name,
      active: row.active,
      matchingStrategy: row.matching_strategy,
      priority: row.priority
    }));
    res.json(rules);
  },

  async create(req: Request, res: Response) {
    const { id = uuidv4(), keyword, assignedToUserId, assignedToUserName, active, matchingStrategy, priority } = req.body;
    await pool.query(
      "INSERT INTO assignment_rules (id, keyword, assigned_to_user_id, assigned_to_user_name, active, matching_strategy, priority) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [id, keyword, assignedToUserId, assignedToUserName, active, matchingStrategy || 'exact', priority || 0]
    );
    res.json({ id, keyword });
  },

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const { keyword, assignedToUserId, assignedToUserName, active, matchingStrategy, priority } = req.body;
    await pool.query(
      `UPDATE assignment_rules SET 
        keyword = COALESCE($1, keyword), 
        assigned_to_user_id = COALESCE($2, assigned_to_user_id), 
        assigned_to_user_name = COALESCE($3, assigned_to_user_name), 
        active = COALESCE($4, active), 
        matching_strategy = COALESCE($5, matching_strategy), 
        priority = COALESCE($6, priority) 
      WHERE id = $7`,
      [keyword, assignedToUserId, assignedToUserName, active, matchingStrategy, priority, id]
    );
    res.json({ success: true });
  },

  async delete(req: Request, res: Response) {
    await pool.query("DELETE FROM assignment_rules WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  }
};
