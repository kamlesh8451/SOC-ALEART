import nodemailer from 'nodemailer';
import pool from '../config/db';

const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3001}`;

async function getTransporter() {
  const result = await pool.query('SELECT * FROM mailbox_settings WHERE is_active = TRUE LIMIT 1');
  if (result.rows.length === 0) {
    console.warn('[NOTIFY] No active mailbox for sending notifications. Using ENV defaults.');
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE !== 'false',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  const settings = result.rows[0];
  // Gmail SMTP is typically smtp.gmail.com / 465
  return nodemailer.createTransport({
    host: settings.host.replace('imap.', 'smtp.'),
    port: 465,
    secure: true,
    auth: {
      user: settings.username,
      pass: settings.password,
    },
  });
}

function actionLink(ticketId: string, action: string, reason?: string) {
  const params = new URLSearchParams({ ticketId, action });
  if (reason) params.set('reason', reason);
  return `${APP_URL}/api/tickets/confirm-action?${params.toString()}`;
}

export async function sendNotification(
  incident: any,
  type: 'alert' | 'daily_digest' | 'reminder',
  recipientEmail?: string
) {
  try {
    const emailData = buildNotificationEmail(incident, type);
    const transporter = await getTransporter();
    const recipient = recipientEmail || process.env.DEFAULT_ALERT_RECIPIENT || 'kamleshgawade786@gmail.com';

    console.log(`[NOTIFY] Sending ${type} email to ${recipient}: ${emailData.subject}`);

    await transporter.sendMail({
      from: `"GuardianSOC Engine" <${transporter.options.auth?.user}>`,
      to: recipient,
      subject: emailData.subject,
      html: emailData.body,
    });

    return true;
  } catch (err: any) {
    console.error('[NOTIFY] Email delivery failed:', err.message);
    return false;
  }
}

export function buildNotificationEmail(
  incident: {
    id: string;
    ticketNumber: string;
    alertName: string;
    severity: string;
    host: string;
    description?: string;
    detectionTime?: number;
    slaDeadline?: number;
    assignedTo?: string;
  },
  type: 'alert' | 'daily_digest' | 'reminder'
) {
  const base = {
    ticketNumber: incident.ticketNumber,
    alertName: incident.alertName,
    severity: incident.severity,
    host: incident.host,
  };

  if (type === 'alert' && (incident.severity === 'critical' || incident.severity === 'high')) {
    const confirmUrl = actionLink(incident.id, 'CONFIRM_CLOSED');
    const notClosedUrl = actionLink(incident.id, 'NOT_CLOSED');
    const extensionUrl = actionLink(incident.id, 'REQUEST_EXTENSION', 'Extension requested via email');

    return {
      subject: `[CRITICAL] ${incident.ticketNumber} — ${incident.alertName}`,
      body: `
        <h2>Critical SOC Alert</h2>
        <p><b>Ticket:</b> ${incident.ticketNumber}</p>
        <p><b>Alert:</b> ${incident.alertName}</p>
        <p><b>Severity:</b> ${incident.severity}</p>
        <p><b>Host:</b> ${incident.host}</p>
        <p><b>Description:</b> ${incident.description || 'N/A'}</p>
        <p><b>SLA Deadline:</b> ${incident.slaDeadline ? new Date(incident.slaDeadline).toISOString() : 'N/A'}</p>
        <p><b>Evidence is required before closure.</b></p>
        <p>
          <a href="${confirmUrl}">YES CONFIRM CLOSED</a> |
          <a href="${notClosedUrl}">NOT CLOSED</a> |
          <a href="${extensionUrl}">REQUEST EXTENSION</a>
        </p>
      `,
      links: { confirmUrl, notClosedUrl, extensionUrl },
      ...base,
    };
  }

  if (type === 'alert') {
    return {
      subject: `[ALERT] ${incident.ticketNumber} — ${incident.alertName}`,
      body: `
        <h2>New SOC Alert</h2>
        <p><b>Ticket:</b> ${incident.ticketNumber}</p>
        <p><b>Alert:</b> ${incident.alertName}</p>
        <p><b>Severity:</b> ${incident.severity}</p>
        <p><b>Host:</b> ${incident.host}</p>
        <p><b>Description:</b> ${incident.description || 'N/A'}</p>
      `,
      ...base,
    };
  }

  if (type === 'daily_digest') {
    return {
      subject: `[DIGEST] Pending SOC tickets — ${incident.ticketNumber}`,
      body: `<p>Daily digest: ${incident.ticketNumber} | ${incident.severity} | ${incident.host} | Owner: ${incident.assignedTo || 'Unassigned'}</p>`,
      ...base,
    };
  }

  return {
    subject: `[REMINDER] ${incident.ticketNumber} pending action`,
    body: `<p>Reminder: ${incident.ticketNumber} requires attention. Severity: ${incident.severity}. Host: ${incident.host}.</p>`,
    ...base,
  };
}
