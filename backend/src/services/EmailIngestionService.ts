import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import pool from '../config/db';
import { v4 as uuidv4 } from 'uuid';
import { getAssignmentForIncident } from './assignmentService';
import { auditService } from './auditService';
import { sendNotification } from './notificationService';
import { SyricService } from './SyricService';
import { SocketService } from './SocketService';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const getDirname = () => {
  try {
    if (typeof __dirname !== 'undefined') return __dirname;
    return path.dirname(fileURLToPath(import.meta.url));
  } catch (e) {
    return process.cwd();
  }
};

const _dirname = getDirname();
const UPLOADS_DIR = path.join(_dirname, '../../uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export class EmailIngestionService {
  private static isRunning = false;

  static async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[MAIL] Email Ingestion Service worker ready');
    
    // Initial run
    this.processAllMailboxes();
    
    // Set interval (Reduced to 10 seconds for high reflectivity)
    setInterval(() => {
      this.processAllMailboxes();
    }, 10 * 1000);
  }

  static async processAllMailboxes() {
    try {
      const result = await pool.query('SELECT * FROM mailbox_settings WHERE is_active = TRUE');
      for (const settings of result.rows) {
        await this.processMailbox(settings);
      }
    } catch (err) {
      console.error('[MAIL] Error processing mailboxes:', err);
    }
  }

  private static async processMailbox(settings: any) {
    console.log(`[MAIL] Starting ingestion for: ${settings.username} (${settings.host})`);
    const client = new ImapFlow({
      host: settings.host,
      port: settings.port,
      secure: settings.ssl,
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production' ? true : false
      },
      auth: {
        user: settings.username,
        pass: settings.password
      },
      logger: false, // Disable extremely verbose logging
      qresync: true,
      connectionTimeout: 30000, // 30 seconds
      greetingTimeout: 30000,
    });

    client.on('error', (err) => {
      console.error('[MAIL] ImapFlow background error:', err.message || err);
    });

    client.on('close', () => {
      console.log('[MAIL] ImapFlow connection closed');
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        // Optimized: Only search for UNSEEN emails to avoid re-processing 
        const uids = await client.search({ seen: false });
        
        if (uids.length === 0) {
          console.log(`[MAIL] No new messages for: ${settings.username}`);
          return;
        }

        console.log(`[MAIL] Found ${uids.length} new emails. Processing...`);

        // Process messages one by one to avoid socket timeouts
        for (const uid of uids) {
          try {
            const message = await client.fetchOne(uid, {
              envelope: true,
              source: true
            });
            
            if (message) {
              const result = await this.handleEmail(message);
              // Mark as seen immediately after processing attempt
              await client.messageFlagsAdd(uid, ['\\Seen']);

              if (result) {
                SocketService.emit('incidents_updated', { type: result });
              }
            }
          } catch (itemErr: any) {
            console.error(`[MAIL] Error processing UID ${uid}:`, itemErr.message);
          }
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[MAIL] Connection error:', message);
    }
  }

  private static async handleEmail(message: any): Promise<'CREATED' | 'APPENDED' | null> {
    const parsed = await simpleParser(message.source);
    const subject = parsed.subject || 'No Subject';
    const sender = parsed.from?.text || 'unknown@sender.com';
    const body = parsed.text || parsed.html || '';
    const receivedAt = parsed.date || new Date();
    const messageId = parsed.messageId?.trim() || crypto
      .createHash('sha256')
      .update(`${sender}|${subject}|${receivedAt.toISOString()}|${body.slice(0, 500)}`)
      .digest('hex');
    const subjectHash = crypto.createHash('md5').update(subject).digest('hex');

    // 1. Duplicate Detection (Message-ID)
    const exists = await pool.query('SELECT 1 FROM email_message_registry WHERE message_id = $1', [messageId]);
    if (exists.rows.length > 0) {
      console.log(`[MAIL] Skipping already processed email: ${subject} from ${sender}`);
      return null;
    }

    console.log(`[MAIL] Processing email: ${subject} from ${sender}`);

    // 2. Thread Management
    const inReplyTo = parsed.inReplyTo;
    const references = Array.isArray(parsed.references) ? parsed.references : (parsed.references ? [parsed.references] : []);
    
    let existingIncidentId: string | null = null;
    
    // Check if it belongs to an existing thread
    if (inReplyTo) {
      const parent = await pool.query('SELECT incident_id FROM email_logs WHERE message_id = $1', [inReplyTo]);
      if (parent.rows.length > 0) existingIncidentId = parent.rows[0].incident_id;
    }

    if (!existingIncidentId && references.length > 0) {
      const parents = await pool.query('SELECT incident_id FROM email_logs WHERE message_id = ANY($1)', [references]);
      if (parents.rows.length > 0) existingIncidentId = parents.rows[0].incident_id;
    }

    // Check for Ticket Ref in subject
    const ticketRefMatch = subject.match(/SOC-\d{4}-\d{4}/);
    if (!existingIncidentId && ticketRefMatch) {
      const refResult = await pool.query('SELECT id FROM incidents WHERE ticket_number = $1', [ticketRefMatch[0]]);
      if (refResult.rows.length > 0) existingIncidentId = refResult.rows[0].id;
    }

    let status: 'CREATED' | 'APPENDED' | null = null;
    if (existingIncidentId) {
      await this.appendToIncident(existingIncidentId, parsed, messageId);
      status = 'APPENDED';
    } else {
      // 3. New Incident Creation
      await this.createNewIncident(parsed, messageId, subjectHash);
      status = 'CREATED';
    }

    // Register message
    await pool.query(
      'INSERT INTO email_message_registry (message_id, subject_hash, sender) VALUES ($1, $2, $3)',
      [messageId, subjectHash, sender]
    );

    return status;
  }

  private static async appendToIncident(incidentId: string, parsed: any, messageId: string) {
    const sender = parsed.from?.text || 'unknown';
    const body = parsed.text || '';
    
    await pool.query(
      'INSERT INTO email_logs (message_id, sender, subject, processed_status, incident_id) VALUES ($1, $2, $3, $4, $5)',
      [messageId, sender, parsed.subject, 'APPENDED', incidentId]
    );

    // Update incident timeline or add a note (here we just log)
    await auditService.logAction(
      'EMAIL_RECEIVED',
      incidentId,
      undefined,
      `Appended email from ${sender} to incident thread`,
      'system'
    );

    await this.handleAttachments(incidentId, parsed);
  }

  private static async createNewIncident(parsed: any, messageId: string, subjectHash: string) {
    const subject = parsed.subject || 'No Subject';
    const body = parsed.text || parsed.html || '';
    const sender = parsed.from?.text || 'unknown';
    const id = uuidv4();
    const ticketNumber = await this.generateUniqueTicketNumber();
    const now = Date.now();

    // Advanced Parsing
    const metadata = this.parseDetailedMetadata(body, subject);
    
    // Auto Assignment & Rule Execution
    const assignment = await getAssignmentForIncident(subject, body);
    if (assignment?.ruleName) {
      console.log(`[RULE] Incident matched rule: ${assignment.ruleName}`);
    }
    
    // Severity Mapping (with override)
    let severity = assignment?.severityOverride || this.mapSeverity(subject, body);
    
    // SLA Calculation
    const slaHours = await this.getSlaHours(severity);
    const slaDeadline = now + slaHours * 60 * 60 * 1000;

    const host = metadata.hostname || 'Unknown Host';
    const correlationId = `mail-${host.toLowerCase().replace(/\s+/g, '-')}`;

    const incidentData = {
      id,
      ticketNumber,
      alertName: subject,
      severity,
      host,
      description: body,
      detectionTime: now,
      slaDeadline,
      status: 'open',
      ownerId: assignment?.userId || 'unassigned',
      domain: metadata.domain || 'Email',
      assignedTo: assignment?.userName || assignment?.teamName || 'Unassigned',
      assignedToUserId: assignment?.userId || null,
      correlationId,
      source: 'EMAIL',
      metadata: JSON.stringify({ 
        messageId, 
        sender, 
        subjectHash,
        sourceIP: metadata.sourceIP,
        destIP: metadata.destIP,
        username: metadata.username,
        hostname: metadata.hostname,
        alertSource: metadata.alertSource
      })
    };

    await pool.query(
      `INSERT INTO incidents (
        id, ticket_number, alert_name, severity, host, description, detection_time, sla_deadline,
        status, owner_id, domain, assigned_to, assigned_to_user_id, correlation_id, source, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        incidentData.id,
        incidentData.ticketNumber,
        incidentData.alertName,
        incidentData.severity,
        incidentData.host,
        incidentData.description,
        incidentData.detectionTime,
        incidentData.slaDeadline,
        incidentData.status,
        incidentData.ownerId,
        incidentData.domain,
        incidentData.assignedTo,
        incidentData.assignedToUserId,
        incidentData.correlationId,
        incidentData.source,
        incidentData.metadata
      ]
    );

    await pool.query(
      'INSERT INTO email_logs (message_id, sender, subject, processed_status, incident_id) VALUES ($1, $2, $3, $4, $5)',
      [messageId, sender, subject, 'CREATED', id]
    );

    await auditService.logAction(
      'CREATE_INCIDENT',
      id,
      ticketNumber,
      `Automatically created from email: ${subject}. Assigned to ${incidentData.assignedTo}.`,
      'system'
    );

    // Automated Syric AI Analysis
    const aiInsights = await SyricService.analyzeIncident(id);

    await this.handleAttachments(id, parsed);
    await this.triggerNotifications({ ...incidentData, ai_insights: aiInsights }, assignment);
  }

  private static parseDetailedMetadata(body: string, subject: string) {
    const text = `${subject}\n${body}`;
    return {
      sourceIP: text.match(/Source IP[:\s]+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i)?.[1],
      destIP: text.match(/Dest(?:ination)? IP[:\s]+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i)?.[1],
      username: text.match(/User(?:name)?[:\s]+([a-zA-Z0-9\._-]+)/i)?.[1],
      hostname: text.match(/Host(?:name)?[:\s]+([a-zA-Z0-9\.-]+)/i)?.[1],
      domain: text.match(/Domain[:\s]+([a-zA-Z0-9\.-]+)/i)?.[1],
      alertSource: text.match(/Source[:\s]+([a-zA-Z0-9\s_-]+)/i)?.[1] || 'Email'
    };
  }

  private static async getSlaHours(severity: string): Promise<number> {
    try {
      const res = await pool.query('SELECT response_time_hours FROM sla_policies WHERE severity = $1', [severity]);
      if (res.rows.length > 0) return res.rows[0].response_time_hours;
    } catch (err) {}
    
    // Fallback
    if (severity === 'critical') return 4;
    if (severity === 'high') return 24;
    if (severity === 'medium') return 48;
    return 72;
  }

  private static async generateUniqueTicketNumber() {
    const year = new Date().getFullYear();
    for (let attempt = 0; attempt < 10; attempt++) {
      const ticketNumber = `SOC-${Math.floor(1000 + Math.random() * 9000)}-${year}`;
      const result = await pool.query('SELECT 1 FROM incidents WHERE ticket_number = $1', [ticketNumber]);
      if (result.rows.length === 0) return ticketNumber;
    }

    throw new Error('Failed to generate a unique ticket number for new incident');
  }

  private static async handleAttachments(incidentId: string, parsed: any) {
    if (!parsed.attachments) return;

    for (const attachment of parsed.attachments) {
      const allowed = ['pdf', 'png', 'jpg', 'txt', 'log', 'zip'];
      const ext = path.extname(attachment.filename || '').toLowerCase().replace('.', '');
      
      if (!allowed.includes(ext)) {
        console.log(`[MAIL] Skipping blocked attachment: ${attachment.filename}`);
        continue;
      }

      const fileName = `${Date.now()}-${attachment.filename}`;
      const filePath = path.join(UPLOADS_DIR, fileName);
      
      fs.writeFileSync(filePath, attachment.content);

      await pool.query(
        'INSERT INTO incident_attachments (incident_id, filename, path, mimetype, size) VALUES ($1, $2, $3, $4, $5)',
        [incidentId, attachment.filename, `/uploads/${fileName}`, attachment.contentType, attachment.size]
      );
    }
  }

  private static async triggerNotifications(incident: any, assignment: any) {
    // Implement duplicate notification prevention as per requirements
    const recipient = assignment?.email || process.env.DEFAULT_ALERT_RECIPIENT || 'kamleshgawade786@gmail.com';
    
    const exists = await pool.query(
      'SELECT 1 FROM notification_logs WHERE incident_id = $1 AND recipient = $2 AND notification_type = $3',
      [incident.id, recipient, 'NEW_INCIDENT']
    );

    if (exists.rows.length > 0) return;

    // Call the real notification service to send the alert email
    const success = await sendNotification(incident, 'alert', recipient);

    if (success) {
      await pool.query(
        'INSERT INTO notification_logs (incident_id, recipient, notification_type) VALUES ($1, $2, $3)',
        [incident.id, recipient, 'NEW_INCIDENT']
      );
    }
  }

  private static mapSeverity(subject: string, body: string): string {
    const text = `${subject} ${body}`.toLowerCase();
    
    const critical = ['ransomware', 'malware', 'phishing', 'exploit', 'attack', 'data breach', 'command and control', 'privilege escalation'];
    if (critical.some(k => text.includes(k))) return 'critical';

    const high = ['suspicious login', 'brute force', 'failed login', 'abnormal traffic', 'unauthorized access'];
    if (high.some(k => text.includes(k))) return 'high';

    const medium = ['latency', 'warning', 'performance issue', 'service degradation'];
    if (medium.some(k => text.includes(k))) return 'medium';

    return 'low';
  }

  private static slaHoursForSeverity(severity: string): number {
    if (severity === 'critical' || severity === 'high') return 24;
    if (severity === 'medium') return 48;
    return 72;
  }
}
