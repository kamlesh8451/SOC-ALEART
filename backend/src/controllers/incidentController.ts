import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';
import { v4 as uuidv4 } from 'uuid';
import { auditService } from '../services/auditService';
import { getAssignmentForIncident } from '../services/assignmentService';
import { ThreatIntelService } from '../services/threatIntelService';
import { SyricService } from '../services/SyricService';
import { sendNotification } from '../services/notificationService';
import { SocketService } from '../services/SocketService';
import PDFDocument from 'pdfkit';

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
      aiInsights: row.ai_insights || null,
      correlationId: row.correlation_id || null,
      assignedTo: row.assigned_to || 'Unassigned',
      assignedToUserId: row.assigned_to_user_id || null,
      acknowledgedAt: row.acknowledged_at ? Number(row.acknowledged_at) : null,
      resolvedAt: row.resolved_at ? Number(row.resolved_at) : null,
      escalationHistory: row.escalation_history || [],
      slaWarningSent: !!row.sla_warning_sent,
      slaBreachedSent: !!row.sla_breached_sent,
      notificationPriority: row.notification_priority || null,
      closureComment: row.closure_comment || null,
      rootCause: row.root_cause || null,
      metadata: row.metadata || {},
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
  // Find the highest ticket number for the current year
  const result = await pool.query(
    `SELECT ticket_number FROM incidents 
     WHERE ticket_number LIKE $1 
     ORDER BY ticket_number DESC LIMIT 1`,
    [`SOC-%-${year}`]
  );

  let nextSeq = 1001;
  if (result.rows.length > 0) {
    const lastTicket = result.rows[0].ticket_number;
    const match = lastTicket.match(/SOC-(\d+)-/);
    if (match) {
      nextSeq = parseInt(match[1]) + 1;
    }
  }

  return `SOC-${nextSeq}-${year}`;
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

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      const incident = mapIncident(result.rows[0]);

      await auditService.logAction(
        'VIEW_INCIDENT',
        id,
        incident.ticketNumber,
        `Viewed incident details`,
        req.headers['x-user-id'] as string
      );

      res.json(incident);
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

      // Automated Threat Intelligence Enrichment
      ThreatIntelService.enrichIncident(id, `${data.alertName} ${data.description || ''}`);

      // Automated Syric AI Analysis
      const aiInsights = await SyricService.analyzeIncident(id);

      // Automated Branded Notification
      if (assignedToUserId) {
        const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [assignedToUserId]);
        if (userRes.rows.length > 0) {
          await sendNotification({
            ...data,
            id,
            ticketNumber,
            slaDeadline,
            ai_insights: aiInsights
          }, 'alert', userRes.rows[0].email);
        }
      }

      res.status(201).json({
        id,
        ticketNumber,
        status: 'open',
        slaDeadline,
        assignedTo: assignedTo || 'Unassigned',
        assignedToUserId: assignedToUserId || null,
        aiInsights
      });

      // Emit real-time update
      SocketService.emit('incidents_updated', { type: 'CREATED' });
    } catch (err) {
      next(err);
    }
  },

  async startSyric(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const aiInsights = await SyricService.analyzeIncident(id);
      
      if (!aiInsights) {
        return res.status(404).json({ error: 'Incident not found or analysis failed' });
      }

      await auditService.logAction(
        'START_SYRIC_ANALYSIS',
        id,
        undefined,
        `Manual Syric analysis triggered. Confidence: ${aiInsights.confidence}`,
        req.headers['x-user-id'] as string
      );

      res.json(aiInsights);
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const incidentRes = await pool.query('SELECT ticket_number FROM incidents WHERE id = $1', [id]);
      if (incidentRes.rows.length === 0) return res.status(404).json({ error: 'Incident not found' });
      const ticketNumber = incidentRes.rows[0].ticket_number;

      await pool.query('DELETE FROM incidents WHERE id = $1', [id]);

      await auditService.logAction(
        'DELETE_INCIDENT',
        id,
        ticketNumber,
        `Incident deleted manually`,
        req.headers['x-user-id'] as string
      );

      // Emit real-time update
      SocketService.emit('incidents_updated', { type: 'DELETED' });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updates = req.body;

      console.log(`[DEBUG] Updating incident ${id}:`, JSON.stringify(updates));

      const allowedFields = new Set([
        'status', 'severity', 'assignedTo', 'assignedToUserId', 
        'ownerId', 'description', 'evidenceUrl', 'extensionRequested', 
        'extensionReason', 'rootCause', 'closureComment'
      ]);

      // Fetch current state to check for transitions
      const currentRes = await pool.query('SELECT status, acknowledged_at, detection_time, ticket_number FROM incidents WHERE id = $1', [id]);
      if (currentRes.rows.length === 0) return res.status(404).json({ error: 'Incident not found' });
      const current = currentRes.rows[0];

      const fields: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      // Logic for MTTA (Acknowledge)
      if (updates.status === 'investigating' && current.status === 'open' && !current.acknowledged_at) {
        updates.acknowledgedAt = Date.now();
      } else if (updates.ownerId && updates.ownerId !== 'unassigned' && !current.acknowledged_at) {
        updates.acknowledgedAt = Date.now();
      }

      // Logic for MTTR (Resolve)
      if (updates.status === 'closed' && current.status !== 'closed') {
        updates.resolvedAt = Date.now();
      }

      for (const [key, value] of Object.entries(updates)) {
        if (!allowedFields.has(key) && key !== 'acknowledgedAt' && key !== 'resolvedAt') continue;

        const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        fields.push(`${snakeKey} = $${i}`);
        values.push(typeof value === 'object' ? JSON.stringify(value) : value);
        i++;
      }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      values.push(id);
      const query = `UPDATE incidents SET ${fields.join(', ')} WHERE id = $${i}`;
      
      try {
        await pool.query(query, values);
      } catch (dbErr: any) {
        console.error('[ERR] SQL Update Failed:', dbErr.message);
        return res.status(500).json({ 
          error: 'Database update failed', 
          details: dbErr.message
        });
      }

      try {
        await auditService.logAction(
          'UPDATE_INCIDENT',
          id,
          current.ticket_number,
          JSON.stringify(updates),
          req.headers['x-user-id'] as string
        );
      } catch (auditErr: any) {
        console.error('[WARN] Audit log failed but incident updated:', auditErr.message);
      }

      // Emit real-time update
      SocketService.emit('incidents_updated', { type: 'UPDATED', id });

      res.json({ success: true });
    } catch (err: any) {
      console.error('[CRIT] Incident Update Controller Crash:', err.message);
      res.status(500).json({ error: err.message });
    }
  },

  async bulkDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No IDs provided' });
      }

      await pool.query('DELETE FROM incidents WHERE id = ANY($1)', [ids]);
      
      await auditService.logAction(
        'BULK_DELETE_INCIDENTS',
        undefined,
        undefined,
        `Deleted ${ids.length} incidents`,
        req.headers['x-user-id'] as string
      );

      // Emit real-time update
      SocketService.emit('incidents_updated', { type: 'BULK_DELETED' });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async bulkUpdateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids, status } = req.body;
      if (!Array.isArray(ids) || ids.length === 0 || !status) {
        return res.status(400).json({ error: 'Missing ids or status' });
      }

      const now = Date.now();
      let query = 'UPDATE incidents SET status = $1';
      const params: any[] = [status];

      if (status === 'investigating') {
        query += ', acknowledged_at = COALESCE(acknowledged_at, $2)';
        params.push(now);
      } else if (status === 'closed') {
        query += ', resolved_at = COALESCE(resolved_at, $2), acknowledged_at = COALESCE(acknowledged_at, $2)';
        params.push(now);
      }

      query += ` WHERE id = ANY($${params.length + 1})`;
      params.push(ids);

      await pool.query(query, params);

      await auditService.logAction(
        'BULK_UPDATE_STATUS',
        undefined,
        undefined,
        `Updated ${ids.length} incidents to ${status}`,
        req.headers['x-user-id'] as string
      );

      // Emit real-time update
      SocketService.emit('incidents_updated', { type: 'BULK_UPDATED' });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async getAnalytics(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pool.query(`
        SELECT 
          AVG(acknowledged_at - detection_time) / 1000 / 60 as avg_mtta_minutes,
          AVG(resolved_at - acknowledged_at) / 1000 / 60 / 60 as avg_mttr_hours
        FROM incidents
        WHERE acknowledged_at IS NOT NULL
      `);

      const stats = result.rows[0];
      res.json({
        mtta: Math.round(parseFloat(stats.avg_mtta_minutes || '0')),
        mttr: Math.round(parseFloat(stats.avg_mttr_hours || '0') * 10) / 10
      });
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

  async exportAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pool.query('SELECT * FROM incidents ORDER BY detection_time DESC');
      const rows = result.rows.map(mapIncident);

      if (rows.length === 0) {
        return res.status(404).json({ error: 'No incidents to export' });
      }

      const headers = Object.keys(rows[0]);
      const csvContent = [
        headers.join(','),
        ...rows.map(row => headers.map(header => {
          const val = (row as any)[header];
          if (val === null || val === undefined) return '';
          const str = String(val).replace(/"/g, '""');
          return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
        }).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=incidents_export_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvContent);
    } catch (err) {
      next(err);
    }
  },

  async exportOne(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM incidents WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      const incident = mapIncident(result.rows[0]);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=incident_${incident.ticketNumber}_report.pdf`);

      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
      doc.pipe(res);

      // Colors & Styles
      const primaryColor = '#0F172A'; // Slate 900
      const secondaryColor = '#64748B'; // Slate 500
      const accentColor = '#3B82F6'; // Blue 500
      const borderColor = '#E2E8F0'; // Slate 200
      
      const severityColors: Record<string, string> = {
        critical: '#DC2626',
        high: '#EA580C',
        medium: '#D97706',
        low: '#059669'
      };

      // Header Section
      doc.rect(0, 0, doc.page.width, 100).fill(primaryColor);
      doc.fillColor('#FFFFFF').fontSize(24).font('Helvetica-Bold').text('GUARDIANSOC', 50, 35);
      doc.fontSize(10).font('Helvetica').text('ENTERPRISE INCIDENT MANAGEMENT PLATFORM', 50, 65, { characterSpacing: 1 });
      
      doc.fontSize(10).font('Helvetica-Bold').text('CONFIDENTIAL REPORT', 400, 40, { align: 'right' });
      doc.fontSize(8).font('Helvetica').text(`GENERATED: ${new Date().toLocaleString()}`, 400, 55, { align: 'right' });
      doc.text(`REFERENCE: ${incident.ticketNumber}`, 400, 68, { align: 'right' });

      doc.moveDown(5);

      // Summary Dashboard Info
      const startY = 130;
      doc.rect(50, startY, 500, 70).fill('#F8FAFC').stroke(borderColor);
      
      // Labels
      doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(8);
      doc.text('TICKET NUMBER', 70, startY + 15);
      doc.text('CURRENT STATUS', 190, startY + 15);
      doc.text('SEVERITY LEVEL', 310, startY + 15);
      doc.text('DETECTION TIME', 430, startY + 15);

      // Values
      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12);
      doc.text(incident.ticketNumber, 70, startY + 30);
      
      const statusColor = incident.status === 'closed' ? '#059669' : (incident.status === 'investigating' ? '#3B82F6' : '#DC2626');
      doc.fillColor(statusColor).text(incident.status.toUpperCase(), 190, startY + 30);
      
      // Severity Badge
      const sevColor = severityColors[incident.severity.toLowerCase()] || severityColors.medium;
      doc.rect(310, startY + 28, 70, 20).fill(sevColor);
      doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold').text(incident.severity.toUpperCase(), 310, startY + 34, { width: 70, align: 'center' });

      doc.fillColor(primaryColor).font('Helvetica').fontSize(9);
      const detTime = new Date(incident.detectionTime).toLocaleString();
      doc.text(detTime, 430, startY + 30, { width: 100 });

      doc.moveDown(5);

      // Section Function
      const drawSectionHeader = (title: string) => {
        doc.moveDown();
        const y = doc.y;
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text(title.toUpperCase(), 50, y);
        doc.moveTo(50, y + 15).lineTo(550, y + 15).strokeColor(borderColor).lineWidth(1).stroke();
        doc.moveDown(1.5);
      };

      // Section: Incident Overview
      drawSectionHeader('Incident Overview');
      
      const overviewY = doc.y;
      doc.fontSize(10).fillColor(secondaryColor).font('Helvetica-Bold').text('Alert Name:', 50, overviewY);
      doc.fillColor(primaryColor).font('Helvetica').text(incident.alertName, 150, overviewY);
      
      doc.fontSize(10).fillColor(secondaryColor).font('Helvetica-Bold').text('Target Host:', 50, overviewY + 20);
      doc.fillColor(primaryColor).font('Helvetica').text(incident.host, 150, overviewY + 20);
      
      doc.fontSize(10).fillColor(secondaryColor).font('Helvetica-Bold').text('Network Domain:', 50, overviewY + 40);
      doc.fillColor(primaryColor).font('Helvetica').text(incident.domain || 'N/A', 150, overviewY + 40);

      doc.fontSize(10).fillColor(secondaryColor).font('Helvetica-Bold').text('SLA Deadline:', 50, overviewY + 60);
      const slaColor = incident.slaBreachedSent ? '#DC2626' : primaryColor;
      doc.fillColor(slaColor).font('Helvetica-Bold').text(new Date(incident.slaDeadline).toLocaleString(), 150, overviewY + 60);

      doc.moveDown(5);

      // Section: Technical Description
      drawSectionHeader('Technical Description');
      doc.fillColor('#334155').font('Helvetica').fontSize(10).text(incident.description || 'No detailed description available.', { align: 'justify', lineGap: 3 });

      doc.moveDown(2);

      // Section: Assignment & Ownership
      drawSectionHeader('Assignment & Ownership');
      const assignY = doc.y;
      doc.fontSize(10).fillColor(secondaryColor).font('Helvetica-Bold').text('Primary Owner:', 50, assignY);
      doc.fillColor(primaryColor).font('Helvetica').text(incident.assignedTo, 150, assignY);
      
      doc.fontSize(10).fillColor(secondaryColor).font('Helvetica-Bold').text('Owner ID:', 50, assignY + 20);
      doc.fillColor(primaryColor).font('Helvetica').text(incident.ownerId || 'Unassigned', 150, assignY + 20);

      doc.moveDown(3);

      // Section: Investigation & Closure
      drawSectionHeader('Investigation & Resolution');
      const investY = doc.y;
      doc.fontSize(10).fillColor(secondaryColor).font('Helvetica-Bold').text('Root Cause:', 50, investY);
      doc.fillColor(primaryColor).font('Helvetica').text(incident.rootCause || 'Under Investigation', 150, investY);
      
      doc.moveDown();
      doc.fontSize(10).fillColor(secondaryColor).font('Helvetica-Bold').text('Closure Notes:', 50, doc.y);
      doc.fillColor(primaryColor).font('Helvetica').text(incident.closureComment || 'N/A', 150, doc.y - 12);

      doc.moveDown(2);

      // Section: Timeline / Escalation
      drawSectionHeader('Timeline & Escalation History');
      if (incident.escalationHistory && incident.escalationHistory.length > 0) {
        incident.escalationHistory.forEach((h: any, idx: number) => {
          const entryY = doc.y;
          doc.circle(55, entryY + 5, 3).fill(accentColor);
          doc.fontSize(9).fillColor(primaryColor).font('Helvetica-Bold').text(new Date(h.timestamp).toLocaleString(), 70, entryY);
          doc.fillColor(secondaryColor).font('Helvetica').text(`User: ${h.userName}`, 200, entryY);
          doc.moveDown(0.5);
          doc.fillColor('#475569').text(h.reason, 70, doc.y, { width: 450 });
          doc.moveDown();
        });
      } else {
        doc.fontSize(10).fillColor(secondaryColor).font('Helvetica').text('No escalation or status changes recorded in timeline.', 50);
      }

      // Section: Metadata (Optional)
      if (incident.metadata && Object.keys(incident.metadata).length > 0) {
        doc.addPage(); // Start metadata on a new page if it's large
        drawSectionHeader('Technical Metadata');
        const metadataY = doc.y;
        doc.fontSize(9).font('Helvetica-Bold').fillColor(secondaryColor);
        
        Object.entries(incident.metadata).forEach(([key, value], idx) => {
          if (value === null || value === undefined) return;
          const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
          
          const currentY = doc.y;
          if (currentY > 700) doc.addPage();
          
          doc.fillColor(secondaryColor).font('Helvetica-Bold').text(`${key}:`, 50);
          doc.fillColor(primaryColor).font('Helvetica').text(displayValue, 150, doc.y - 12);
          doc.moveDown(0.5);
        });
      }

      // Finalize PDF (Footer handled by page event)
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        
        // Footer bar
        doc.rect(0, doc.page.height - 50, doc.page.width, 50).fill('#F1F5F9');
        doc.fillColor(secondaryColor).fontSize(8).font('Helvetica').text(
          `GuardianSOC Security Platform | ${incident.ticketNumber} | Page ${i + 1} of ${range.count}`,
          50,
          doc.page.height - 30,
          { align: 'center' }
        );
      }

      doc.end();
    } catch (err) {
      next(err);
    }
  },

  async importCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const { csvData } = req.body;
      if (!csvData) return res.status(400).json({ error: 'No CSV data provided' });

      const lines = csvData.split('\n');
      if (lines.length < 2) return res.status(400).json({ error: 'Invalid CSV format' });

      const headers = lines[0].split(',').map((h: string) => h.trim());
      const results = [];
      let skipped = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',').map((v: string) => v.trim().replace(/^"|"$/g, ''));
        const data: any = {};
        headers.forEach((h: string, index: number) => {
          data[h] = values[index];
        });

        const alertName = data.alertName || data.alert_name || 'Imported Alert';
        const host = data.host || 'unknown';
        const description = data.description || '';
        const severity = data.severity || 'medium';

        // DE-DUPLICATION LOGIC
        // Check if an identical incident (same alert, host, and description) already exists
        const existing = await pool.query(
          'SELECT id FROM incidents WHERE alert_name = $1 AND host = $2 AND description = $3 LIMIT 1',
          [alertName, host, description]
        );

        if (existing.rows.length > 0) {
          skipped++;
          continue;
        }

        // Map fields to DB
        const id = uuidv4();
        const ticketNumber = await generateUniqueTicketNumber();
        
        // Use CSV detection time if provided, otherwise now
        const detectionTime = data.detectionTime || data.detection_time 
          ? Number(data.detectionTime || data.detection_time) 
          : Date.now();
          
        const slaDeadline = detectionTime + slaHoursForSeverity(severity) * 60 * 60 * 1000;

        await pool.query(
          `INSERT INTO incidents (
            id, ticket_number, alert_name, severity, host, description, detection_time, sla_deadline,
            status, owner_id, domain, assigned_to, source
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            id,
            ticketNumber,
            alertName,
            severity,
            host,
            description,
            detectionTime,
            slaDeadline,
            data.status || 'open',
            'unassigned',
            data.domain || '',
            'Unassigned',
            'IMPORT'
          ]
        );
        results.push(ticketNumber);
        
        // Automated Threat Intelligence Enrichment for imported items too
        ThreatIntelService.enrichIncident(id, `${alertName} ${description}`);
      }

      await auditService.logAction(
        'IMPORT_INCIDENTS',
        undefined,
        undefined,
        `Imported ${results.length} incidents from CSV (Skipped ${skipped} duplicates)`,
        req.headers['x-user-id'] as string
      );

      res.json({ success: true, count: results.length, skipped, tickets: results });
    } catch (err) {
      next(err);
    }
  },
};
