import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';

export const auditController = {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { incidentId } = req.query;
      let queryStr = "SELECT * FROM audit_logs";
      const params = [];
      if (incidentId) {
        queryStr += " WHERE incident_id = $1";
        params.push(incidentId);
      }
      queryStr += " ORDER BY timestamp DESC LIMIT 100";
      
      const result = await pool.query(queryStr, params);
      const logs = result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        action: row.action,
        incidentId: row.incident_id,
        ticketNumber: row.ticket_number,
        details: row.details,
        timestamp: Number(row.timestamp)
      }));
      res.json(logs);
    } catch (err) {
      next(err);
    }
  }
};
