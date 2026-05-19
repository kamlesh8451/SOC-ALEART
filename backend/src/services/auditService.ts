import pool from '../config/db';

export const auditService = {
  async logAction(action: string, incidentId?: string, ticketNumber?: string, details?: string, userId?: string) {
    try {
      await pool.query(
        "INSERT INTO audit_logs (user_id, action, incident_id, ticket_number, details, timestamp) VALUES ($1, $2, $3, $4, $5, $6)",
        [userId || "system-gateway", action, incidentId || null, ticketNumber || null, details || "", Date.now()]
      );
    } catch (error: any) {
      console.error(`[ERR] Audit log failed (${action}):`, error.message);
    }
  }
};
