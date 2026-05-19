import { Request, Response } from 'express';
import pool from '../config/db';
import { auditService } from '../services/auditService';

export const ticketController = {
  async uploadEvidence(req: Request, res: Response) {
    try {
      const { ticketId } = req.body;
      const file = req.file;

      if (!ticketId || !file) {
        return res.status(400).json({ error: "Ticket ID and file required" });
      }

      // Mocking successful upload - in real app, save to S3/Cloud Storage
      const simulatedUrl = `https://picsum.photos/seed/${ticketId}/800/600`;
      
      await pool.query(
        "UPDATE incidents SET evidence_url = $1, updated_at = NOW() WHERE id = $2",
        [simulatedUrl, ticketId]
      );

      await auditService.logAction('UPLOAD_EVIDENCE', ticketId, undefined, `File simulated upload: ${file.originalname}`);

      res.json({ success: true, url: simulatedUrl });
    } catch (error: any) {
      console.error("Upload process error:", error);
      res.status(500).json({ error: "Upload pipeline disrupted" });
    }
  },

  async confirmAction(req: Request, res: Response) {
    try {
      const { ticketId, action, evidence, role } = req.body;
      
      if (action === 'ESCALATE' && role !== 'soc_lead' && role !== 'admin') {
        return res.status(403).json({ error: "Only SOC Lead can escalate incidents" });
      }

      if (!ticketId || !action) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await pool.query("SELECT * FROM incidents WHERE id = $1", [ticketId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Incident not found" });
      }
      const incident = result.rows[0];

      if (action === 'CONFIRM_CLOSED') {
        if (!evidence && !incident.evidence_url) {
          return res.status(400).json({ error: "Evidence is required to close the ticket" });
        }
        await pool.query(
          "UPDATE incidents SET status = 'closed', evidence_url = COALESCE($1, evidence_url), updated_at = NOW() WHERE id = $2",
          [evidence || null, ticketId]
        );
      } else if (action === 'REQUEST_EXTENSION') {
        await pool.query(
          "UPDATE incidents SET extension_requested = TRUE, extension_reason = $1, updated_at = NOW() WHERE id = $2",
          [evidence || null, ticketId]
        );
      } else if (action === 'ESCALATE') {
        const entry = {
          reason: evidence || "Escalated via API",
          timestamp: Date.now(),
          userId: role || "unknown",
          userName: role === 'soc_lead' ? "SOC Lead" : "Command Operative"
        };
        
        const history = incident.escalation_history || [];
        history.push(entry);

        await pool.query(
          "UPDATE incidents SET status = 'escalated', escalation_history = $1, updated_at = NOW() WHERE id = $2",
          [JSON.stringify(history), ticketId]
        );
      }

      await auditService.logAction(action, ticketId, incident.ticket_number, `Action triggered via API. Reason/Evidence: ${evidence || 'N/A'}`, role);

      res.json({ success: true, message: `Action ${action} processed successfully` });
    } catch (error: any) {
      console.error("Confirm Action Error:", error);
      res.status(500).json({ error: "Failed to process ticket action" });
    }
  },

  async confirmActionLink(req: Request, res: Response) {
    const { ticketId, action, reason } = req.query;
    
    if (!ticketId || !action) {
      return res.status(400).send("<h1>Error</h1><p>Missing parameters.</p>");
    }

    try {
      const result = await pool.query("SELECT * FROM incidents WHERE id = $1", [ticketId]);
      if (result.rows.length === 0) {
        return res.status(404).send("<h1>Error</h1><p>Incident not found.</p>");
      }
      const incident = result.rows[0];

      let successMessage = "Action registered and synchronized.";

      if (action === 'CONFIRM_CLOSED') {
        await pool.query("UPDATE incidents SET status = 'closed', updated_at = NOW() WHERE id = $1", [ticketId]);
        await auditService.logAction('CONFIRM_CLOSED_EMAIL', ticketId as string, incident.ticket_number, "Closed via email link confirmation");
        successMessage = "Incident closed successfully.";
      } else if (action === 'NOT_CLOSED') {
         await auditService.logAction('ACK_NOT_CLOSED', ticketId as string, incident.ticket_number, "User acknowledged ticket is still open via email");
         successMessage = "Incident status confirmed as OPEN.";
      } else if (action === 'REQUEST_EXTENSION') {
        await pool.query(
          "UPDATE incidents SET extension_requested = TRUE, extension_reason = $1, updated_at = NOW() WHERE id = $2",
          [(reason as string) || "Requested via remote email link", ticketId]
        );
        await auditService.logAction('REQUEST_EXTENSION_EMAIL', ticketId as string, incident.ticket_number, `Extension requested via email. Reason: ${reason || 'Not specified'}`);
        successMessage = "SLA extension request submitted to management.";
      }

      res.send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #f4f4f4;">
            <div style="display:inline-block; border: 1px solid #ccc; padding: 40px; border-radius: 10px; background: white; shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #1a237e;">SOC Action Logged</h2>
              <p style="font-size: 18px; color: #2e7d32; font-weight: bold;">${successMessage}</p>
              <p>Ticket: <b>${incident.ticket_number}</b></p>
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #666;">Redirecting to GuardianSOC Command Dashboard...</p>
              <script>setTimeout(() => { window.location.href = '/'; }, 3500);</script>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Email confirm error:", error);
      res.status(500).send("<h1>Error</h1><p>Failed to process action.</p>");
    }
  }
};
