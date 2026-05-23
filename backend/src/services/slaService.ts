import pool from '../config/db';
import { auditService } from './auditService';

export const slaService = {
  async checkSLAs() {
    try {
      const now = Date.now();
      const twoHoursFromNow = now + (2 * 60 * 60 * 1000);
      
      // Query approaching breach
      const approachingRes = await pool.query(
        "SELECT * FROM incidents WHERE sla_deadline <= $1 AND sla_deadline > $2 AND status != 'closed' AND sla_warning_sent = FALSE",
        [twoHoursFromNow, now]
      );

      for (const incident of approachingRes.rows) {
        console.log(`[SLA WARNING] Ticket ${incident.ticket_number} is approaching breach!`);
        await auditService.logAction("SLA_WARNING", incident.id, incident.ticket_number, "SLA approaching breach (less than 2h remaining)");
        await pool.query(
          "UPDATE incidents SET sla_warning_sent = TRUE, notification_priority = 'high', updated_at = NOW() WHERE id = $1",
          [incident.id]
        );
      }

      // Query already breached
      const breachedRes = await pool.query(
        "SELECT * FROM incidents WHERE sla_deadline <= $1 AND status != 'closed' AND sla_breached_sent = FALSE",
        [now]
      );

      for (const incident of breachedRes.rows) {
        console.log(`[SLA BREACHED] Ticket ${incident.ticket_number} has breached SLA!`);
        await auditService.logAction("SLA_BREACH", incident.id, incident.ticket_number, "SLA deadline exceeded");
        await pool.query(
          "UPDATE incidents SET sla_breached_sent = TRUE, notification_priority = 'critical', updated_at = NOW() WHERE id = $1",
          [incident.id]
        );
      }
    } catch (error: any) {
      console.error("[ERR] SLA Monitor Internal Error:", error.message || error);
    }
  },

  startMonitor() {
    console.log("[SYS] SLA Monitoring Engine worker ready");
  }
};
