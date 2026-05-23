import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';
import { v4 as uuidv4 } from 'uuid';
import { auditService } from '../services/auditService';
import { getAssignmentForIncident } from '../services/assignmentService';

function mapIncident(row: Record<string, any>) {
  try {
    return {
      id: row.id || '',
      ticketNumber: row.ticket_number || 'N/A',
      alertName: row.alert_name || 'Unknown Alert',
      severity: row.severity || 'medium',
      host: row.host || 'unknown',
      description: row.description || '',
      detectionTime: row.detection_time ? Number(row.detection_time) : Date.now(),
      slaDeadline: row.sla_deadline ? Number(row.sla_deadline) : Date.now(),
      status: row.status || 'open',
      ownerId: row.owner_id || 'unassigned',
      domain: row.domain || '',
      evidenceUrl: row.evidence_url || null,
      extensionRequested: !!row.extension_requested,
      extensionReason: row.extension_reason || null,
      correlationId: row.correlation_id || null,
      assignedTo: row.assigned_to || 'Unassigned',
      assignedToUserId: row.assigned_to_user_id || null,
      escalationHistory: row.escalation_history || [],
      slaWarningSent: !!row.sla_warning_sent,
      slaBreachedSent: !!row.sla_breached_sent,
      notificationPriority: row.notification_priority || null,
      closureComment: row.closure_comment || null,
      rootCause: row.root_cause || null,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  } catch (err) {
    console.error('[ERR] Failed to map incident row:', err);
    throw err;
  }
}

function slaHoursForSeverity(severity: string): number {
  if (severity === 'critical' || severity === 'high') return 24;
  if (severity === 'medium') return 48;
  return 72;
}

async function generateUniqueTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `SOC-${Math.floor(1000 + Math.random() * 9000)}-${year}`;
    const existing = await pool.query('SELECT 1 FROM incidents WHERE ticket_number = $1', [candidate]);
    if (existing.rows.length === 0) return candidate;
  }
  throw new Error('Unable to generate a unique ticket number');
}

export const incidentController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pool.query('SELECT * FROM incidents ORDER BY detection_time DESC');
      res.json(result.rows.map(mapIncident));
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const id = uuidv4();
      const ticketNumber = await generateUniqueTicketNumber();
      const now = Date.now();
      const slaDeadline = now + slaHoursForSeverity(data.severity) * 60 * 60 * 1000;

      let ownerId = data.ownerId;
      let assignedTo = data.assignedTo;
      let assignedToUserId = data.assignedToUserId;
      if (!ownerId || ownerId === 'unassigned') {
        const match = await getAssignmentForIncident(data.alertName, data.description || '');
        if (match) {
          ownerId = match.id;
          assignedTo = match.name;
          assignedToUserId = match.id;
        }
      }

      const correlationId = data.correlationId || `host-${(data.host || 'unknown').toLowerCase()}`;

      await pool.query(
        `INSERT INTO incidents (
          id, ticket_number, alert_name, severity, host, description, detection_time, sla_deadline,
          status, owner_id, domain, assigned_to, assigned_to_user_id, correlation_id, escalation_history
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          id,
          ticketNumber,
          data.alertName,
          data.severity,
          data.host,
          data.description || '',
          now,
          slaDeadline,
          'open',
          ownerId || 'unassigned',
          data.domain || '',
          assignedTo || 'Unassigned',
          assignedToUserId || null,
          correlationId,
          JSON.stringify([]),
        ]
      );

      await auditService.logAction(
        'CREATE_INCIDENT',
        id,
        ticketNumber,
        `Severity: ${data.severity}, Host: ${data.host}`,
        req.headers['x-user-id'] as string
      );

      res.status(201).json({
        id,
        ticketNumber,
        status: 'open',
        slaDeadline,
        assignedTo: assignedTo || 'Unassigned',
        assignedToUserId: assignedToUserId || null,
      });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const fields: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      for (const [key, value] of Object.entries(updates)) {
        const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        fields.push(`${snakeKey} = $${i}`);
        values.push(typeof value === 'object' ? JSON.stringify(value) : value);
        i++;
      }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(id);
      await pool.query(
        `UPDATE incidents SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i}`,
        values
      );

      await auditService.logAction(
        'UPDATE_INCIDENT',
        id,
        undefined,
        JSON.stringify(updates),
        req.headers['x-user-id'] as string
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async getRelated(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const incidentRes = await pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
      if (incidentRes.rows.length === 0) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      const incident = incidentRes.rows[0];
      let queryStr = 'SELECT * FROM incidents WHERE id != $1 AND (host = $2';
      const params: unknown[] = [id, incident.host];

      if (incident.correlation_id) {
        queryStr += ' OR correlation_id = $3';
        params.push(incident.correlation_id);
      }
      queryStr += ') ORDER BY detection_time DESC LIMIT 10';

      const relatedRes = await pool.query(queryStr, params);
      res.json(relatedRes.rows.map(mapIncident));
    } catch (err) {
      next(err);
    }
  },

  async getStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const statsRes = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'open') as open_count,
          COUNT(*) FILTER (WHERE status = 'investigating') as investigating_count,
          COUNT(*) FILTER (WHERE status = 'closed') as closed_count,
          COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
          COUNT(*) FILTER (WHERE severity = 'high') as high_count,
          COUNT(*) FILTER (WHERE severity = 'medium' OR severity = 'TEST') as medium_count,
          COUNT(*) FILTER (WHERE severity = 'low') as low_count,
          COUNT(*) as total_count
        FROM incidents
      `);

      const velocityRes = await pool.query(`
        SELECT 
          to_char(date_trunc('day', to_timestamp(detection_time / 1000)), 'Dy') as name,
          COUNT(*) FILTER (WHERE status != 'closed') as open,
          COUNT(*) FILTER (WHERE status = 'closed') as closed
        FROM incidents
        WHERE detection_time > (extract(epoch from now()) * 1000 - 7 * 24 * 60 * 60 * 1000)
        GROUP BY date_trunc('day', to_timestamp(detection_time / 1000)), name
        ORDER BY date_trunc('day', to_timestamp(detection_time / 1000)) ASC
      `);

      const stats = statsRes.rows[0];
      
      res.json({
        version: '4.2.1-FIXED-STATS',
        open: parseInt(stats.open_count || '0'),
        investigating: parseInt(stats.investigating_count || '0'),
        closed: parseInt(stats.closed_count || '0'),
        critical: parseInt(stats.critical_count || '0'),
        high: parseInt(stats.high_count || '0'),
        medium: parseInt(stats.medium_count || '0'),
        low: parseInt(stats.low_count || '0'),
        total: parseInt(stats.total_count || '0'),
        compliance: stats.total_count > 0 
          ? Math.round((parseInt(stats.closed_count || '0') / parseInt(stats.total_count || '0')) * 100) 
          : 100,
        velocity: velocityRes.rows.map(v => ({
          name: v.name,
          open: parseInt(v.open || '0'),
          closed: parseInt(v.closed || '0')
        }))
      });
    } catch (err) {
      next(err);
    }
  },
};
