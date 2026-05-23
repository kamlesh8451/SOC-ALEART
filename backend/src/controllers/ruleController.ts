import { Request, Response } from 'express';
import pool from '../config/db';
import { v4 as uuidv4 } from 'uuid';

export const ruleController = {
  async getAll(req: Request, res: Response) {
    const result = await pool.query("SELECT * FROM assignment_rules ORDER BY priority DESC");
    res.json(result.rows);
  },

  async create(req: Request, res: Response) {
    const { 
      id = uuidv4(), 
      name, 
      keyword, 
      assignedToUserId, 
      assignedToUserName, 
      active = true, 
      matchingStrategy = 'contains', 
      priority = 0,
      severityOverride,
      autoSlaAssignment = true,
      sendNotifications = true
    } = req.body;

    await pool.query(
      `INSERT INTO assignment_rules (
        id, name, keyword, assigned_to_user_id, assigned_to_user_name, 
        active, matching_strategy, priority, severity_override, 
        auto_sla_assignment, send_notifications
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id, name, keyword, assignedToUserId, assignedToUserName, 
        active, matchingStrategy, priority, severityOverride, 
        autoSlaAssignment, sendNotifications
      ]
    );
    res.json({ id, name, keyword });
  },

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const { 
      name, 
      keyword, 
      assignedToUserId, 
      assignedToUserName, 
      active, 
      matchingStrategy, 
      priority,
      severityOverride,
      autoSlaAssignment,
      sendNotifications
    } = req.body;

    await pool.query(
      `UPDATE assignment_rules SET 
        name = COALESCE($1, name),
        keyword = COALESCE($2, keyword), 
        assigned_to_user_id = COALESCE($3, assigned_to_user_id), 
        assigned_to_user_name = COALESCE($4, assigned_to_user_name), 
        active = COALESCE($5, active), 
        matching_strategy = COALESCE($6, matching_strategy), 
        priority = COALESCE($7, priority),
        severity_override = COALESCE($8, severity_override),
        auto_sla_assignment = COALESCE($9, auto_sla_assignment),
        send_notifications = COALESCE($10, send_notifications)
      WHERE id = $11`,
      [
        name, keyword, assignedToUserId, assignedToUserName, 
        active, matchingStrategy, priority, severityOverride, 
        autoSlaAssignment, sendNotifications, id
      ]
    );
    res.json({ success: true });
  },

  async delete(req: Request, res: Response) {
    await pool.query("DELETE FROM assignment_rules WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  }
};
