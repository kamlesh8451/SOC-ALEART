import { Request, Response } from 'express';
import pool from '../config/db';
import { v4 as uuidv4 } from 'uuid';
import { auditService } from '../services/auditService';

export const incidentController = {
  async getAll(req: Request, res: Response) {
    const result = await pool.query("SELECT * FROM incidents ORDER BY detection_time DESC");
    const incidents = result.rows.map(row => ({
      id: row.id,
      ticketNumber: row.ticket_number,
      alertName: row.alert_name,
      severity: row.severity,
      host: row.host,
      description: row.description,
      detectionTime: Number(row.detection_time),
      slaDeadline: Number(row.sla_deadline),
      status: row.status,
      ownerId: row.owner_id,
      domain: row.domain,
      evidenceUrl: row.evidence_url,
      extensionRequested: row.extension_requested,
      extensionReason: row.extension_reason,
      correlationId: row.correlation_id,
      assignedTo: row.assigned_to,
      escalationHistory: row.escalation_history,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    res.json(incidents);
  },

  async create(req: Request, res: Response) {
    const data = req.body;
    const id = uuidv4();
    const ticketNumber = `SOC-${Math.floor(1000 + Math.random() * 9000)}-${new Date().getFullYear()}`;
    const now = Date.now();
    
    let slaHours = 72;
    if (data.severity === 'critical' || data.severity === 'high') slaHours = 24;
    else if (data.severity === 'medium') slaHours = 48;
    const slaDeadline = now + (slaHours * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO incidents (
        id, ticket_number, alert_name, severity, host, description, detection_time, sla_deadline, status, owner_id, domain, assigned_to, escalation_history
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        id, ticketNumber, data.alertName, data.severity, data.host, data.description || "", 
        now, slaDeadline, 'open', data.ownerId || "unassigned", data.domain || "", 
        data.assignedTo || "Unassigned", JSON.stringify([])
      ]
    );

    await auditService.logAction("CREATE_INCIDENT", id, ticketNumber, `Severity: ${data.severity}, Host: ${data.host}`);
    res.json({ id, ticketNumber, status: 'open' });
  },

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const updates = req.body;
    
    const fields = [];
    const values = [];
    let i = 1;

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      fields.push(`${snakeKey} = $${i}`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      i++;
    }

    if (fields.length === 0) return res.status(400).json({ error: "No fields to update" });

    values.push(id);
    await pool.query(
      `UPDATE incidents SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${i}`,
      values
    );

    res.json({ success: true });
  },

  async getRelated(req: Request, res: Response) {
    const { id } = req.params;
    const incidentRes = await pool.query("SELECT * FROM incidents WHERE id = $1", [id]);
    if (incidentRes.rows.length === 0) return res.status(404).json({ error: "Incident not found" });
    
    const incident = incidentRes.rows[0];
    let queryStr = "SELECT * FROM incidents WHERE id != $1 AND (host = $2";
    const params = [id, incident.host];
    
    if (incident.correlation_id) {
      queryStr += " OR correlation_id = $3";
      params.push(incident.correlation_id);
    }
    queryStr += ") LIMIT 10";
    
    const relatedRes = await pool.query(queryStr, params);
    const incidents = relatedRes.rows.map(row => ({
      id: row.id,
      ticketNumber: row.ticket_number,
      alertName: row.alert_name,
      severity: row.severity,
      host: row.host,
      description: row.description,
      detectionTime: Number(row.detection_time),
      slaDeadline: Number(row.sla_deadline),
      status: row.status,
      ownerId: row.owner_id,
      domain: row.domain,
      evidenceUrl: row.evidence_url,
      extensionRequested: row.extension_requested,
      extensionReason: row.extension_reason,
      correlationId: row.correlation_id,
      assignedTo: row.assigned_to,
      escalationHistory: row.escalation_history,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    res.json(incidents);
  }
};
