import nodemailer from 'nodemailer';
import pool from '../config/db';

const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3001}`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

async function getTransporter() {
  // Priority 1: Direct SMTP environment variables
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE !== 'false',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Priority 2: Use active mailbox settings
  const result = await pool.query('SELECT * FROM mailbox_settings WHERE is_active = TRUE LIMIT 1');
  if (result.rows.length > 0) {
    const settings = result.rows[0];
    return nodemailer.createTransport({
      host: settings.host.replace('imap.', 'smtp.'),
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE !== 'false',
      auth: {
        user: settings.username,
        pass: settings.password,
      },
    });
  }

  // Fallback (might fail if credentials missing)
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function actionLink(ticketId: string, action: string, reason?: string) {
  const params = new URLSearchParams({ ticketId, action });
  if (reason) params.set('reason', reason);
  // Action links go to the BACKEND API
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
    domain?: string;
    ai_insights?: any;
    metadata?: string | any;
  },
  type: 'alert' | 'daily_digest' | 'reminder'
) {
  const base = {
    ticketNumber: incident.ticketNumber,
    alertName: incident.alertName,
    severity: incident.severity,
    host: incident.host,
  };

  const confirmUrl = actionLink(incident.id, 'CONFIRM_CLOSED');
  const updateUrl = `${FRONTEND_URL}?incidentId=${incident.id}`;
  const escalateUrl = actionLink(incident.id, 'ESCALATE');
  const syricUrl = `${FRONTEND_URL}?incidentId=${incident.id}&view=syric`; 

  // Parse metadata if available
  let metadata: any = {};
  try {
    if (typeof incident.metadata === 'string') {
      metadata = JSON.parse(incident.metadata);
    } else if (incident.metadata) {
      metadata = incident.metadata;
    }
  } catch (e) {
    console.warn('[NOTIFY] Failed to parse incident metadata');
  }

  // Branding Colors & Assets
  const theme = {
    bg: '#050505',
    card: '#0d0d0d',
    cardLight: '#151515',
    border: '#1a1a1a',
    text: '#ffffff',
    textMuted: '#666666',
    primary: '#ef4444', // Red
    secondary: '#eab308', // Yellow
    accent: '#06b6d4', // Cyan
  };

  const severityScore = incident.severity === 'critical' ? 10 : (incident.severity === 'high' ? 8 : (incident.severity === 'medium' ? 6 : 4));
  const severityColor = severityScore >= 9 ? theme.primary : (severityScore >= 6 ? theme.secondary : theme.accent);
  
  // Severity Meter HTML
  const severityBars = Array.from({ length: 10 }, (_, i) => 
    `<div style="display:inline-block; width:15px; height:6px; background-color:${i < severityScore ? severityColor : '#222'}; margin-right:3px; border-radius:1px;"></div>`
  ).join('');

  const insights = incident.ai_insights || {
    summary: incident.description || 'New security event detected on production node.',
    indicator: 'Host Activity',
    insight: 'Initial triage suggests non-standard behavior patterns detected by the edge monitoring node.',
    recommendations: [
      'Isolate host from the network immediately.',
      'Review user sessions active during the detection time.',
      'Analyze suspicious process memory for indicators of compromise.',
      'Validate if this activity matches a known maintenance window.'
    ],
    mitre: { tactic: 'Initial Access', technique: 'Unknown' }
  };

  if (type === 'alert') {
    return {
      subject: `🚨 [PRIORITY ${incident.severity.toUpperCase()}] ${incident.ticketNumber} — ${incident.alertName}`,
      body: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GuardianSOC Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${theme.bg}; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${theme.text};">
  <center style="width: 100%; background-color: ${theme.bg}; padding-top: 40px; padding-bottom: 40px;">
    <div style="max-width: 650px; margin: 0 auto; background-color: ${theme.card}; border: 1px solid ${theme.border}; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
      
      <!-- HEADER BANNER -->
      <div style="background: linear-gradient(135deg, #111 0%, #000 100%); padding: 35px; border-bottom: 1px solid ${theme.border};">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align: middle;">
              <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <div style="background-color: ${theme.primary}; width: 24px; height: 24px; border-radius: 4px; display: inline-block; vertical-align: middle; margin-right: 10px;"></div>
                <span style="font-size: 14px; font-weight: 800; letter-spacing: 2px; color: ${theme.text}; text-transform: uppercase;">Guardian<span style="color: ${theme.primary};">SOC</span></span>
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: ${theme.primary}; text-transform: uppercase; letter-spacing: -0.5px; line-height: 1.2;">
                ${incident.alertName}
              </h1>
              <div style="margin-top: 8px; font-family: 'Courier New', monospace; font-size: 12px; color: ${theme.textMuted}; font-weight: bold;">
                TICKET_ID: ${incident.ticketNumber}
              </div>
            </td>
            <td align="right" style="vertical-align: middle;">
              <div style="font-size: 10px; font-weight: 800; color: ${theme.textMuted}; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px;">Severity: ${severityScore}/10</div>
              <div style="margin-bottom: 5px;">${severityBars}</div>
              <div style="display: inline-block; padding: 4px 10px; border-radius: 4px; background-color: ${severityColor}20; border: 1px solid ${severityColor}40; color: ${severityColor}; font-size: 10px; font-weight: 900; text-transform: uppercase;">
                ${incident.severity}
              </div>
            </td>
          </tr>
        </table>
      </div>

      <!-- INCIDENT SUMMARY CARD -->
      <div style="padding: 30px;">
        <div style="background-color: ${theme.cardLight}; border-radius: 8px; padding: 25px; border: 1px solid ${theme.border}; margin-bottom: 25px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="50%" style="padding-bottom: 20px;">
                <div style="font-size: 10px; font-weight: 800; color: ${theme.textMuted}; text-transform: uppercase; margin-bottom: 4px;">Username</div>
                <div style="font-size: 14px; font-weight: bold;">${metadata.username || 'System'}</div>
              </td>
              <td width="50%" style="padding-bottom: 20px;">
                <div style="font-size: 10px; font-weight: 800; color: ${theme.textMuted}; text-transform: uppercase; margin-bottom: 4px;">Hostname</div>
                <div style="font-size: 14px; font-weight: bold;">${incident.host}</div>
              </td>
            </tr>
            <tr>
              <td width="50%" style="padding-bottom: 20px;">
                <div style="font-size: 10px; font-weight: 800; color: ${theme.textMuted}; text-transform: uppercase; margin-bottom: 4px;">Source IP</div>
                <div style="font-size: 14px; font-family: 'Courier New', monospace;">${metadata.sourceIP || 'N/A'}</div>
              </td>
              <td width="50%" style="padding-bottom: 20px;">
                <div style="font-size: 10px; font-weight: 800; color: ${theme.textMuted}; text-transform: uppercase; margin-bottom: 4px;">Alert Source</div>
                <div style="font-size: 14px; font-weight: bold;">${metadata.alertSource || 'Endpoint Agent'}</div>
              </td>
            </tr>
            <tr>
              <td colspan="2">
                <div style="font-size: 10px; font-weight: 800; color: ${theme.textMuted}; text-transform: uppercase; margin-bottom: 8px;">Incident Description</div>
                <div style="font-size: 13px; line-height: 1.6; color: #bbb; background-color: #000; padding: 15px; border-radius: 6px; border: 1px solid #111;">
                  ${incident.description || 'No detailed description available.'}
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- INTEL SECTION (MITRE + AI) -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
          <tr>
            <td width="48%" style="vertical-align: top; background-color: #111; border-radius: 8px; border: 1px solid ${theme.border}; padding: 20px;">
              <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <div style="background-color: ${theme.accent}; width: 12px; height: 12px; border-radius: 2px; margin-right: 8px;"></div>
                <span style="font-size: 11px; font-weight: 800; color: ${theme.text}; text-transform: uppercase; letter-spacing: 1px;">MITRE ATT&CK</span>
              </div>
              <div style="margin-bottom: 12px;">
                <div style="font-size: 10px; color: ${theme.textMuted}; text-transform: uppercase;">Tactic</div>
                <div style="font-size: 13px; font-weight: bold; margin-top: 2px; color: ${theme.accent};">${insights.mitre.tactic}</div>
              </div>
              <div>
                <div style="font-size: 10px; color: ${theme.textMuted}; text-transform: uppercase;">Technique</div>
                <div style="font-size: 12px; font-weight: bold; margin-top: 2px;">${insights.mitre.technique}</div>
              </div>
            </td>
            <td width="4%">&nbsp;</td>
            <td width="48%" style="vertical-align: top; background-color: #111; border-radius: 8px; border: 1px solid ${theme.border}; padding: 20px;">
              <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <div style="background-color: ${theme.secondary}; width: 12px; height: 12px; border-radius: 2px; margin-right: 8px;"></div>
                <span style="font-size: 11px; font-weight: 800; color: ${theme.text}; text-transform: uppercase; letter-spacing: 1px;">Syric AI Insight</span>
              </div>
              <div style="font-size: 12px; line-height: 1.5; color: #ccc; font-style: italic;">
                "${insights.insight}"
              </div>
            </td>
          </tr>
        </table>

        <!-- RECOMMENDATIONS -->
        <div style="margin-bottom: 30px;">
          <h3 style="font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: ${theme.text}; margin-bottom: 15px; display: flex; align-items: center;">
            <span style="color: ${theme.primary}; margin-right: 8px;">❱</span> Response Actions & Recommendations
          </h3>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${insights.recommendations.map((r: string, idx: number) => `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #111; vertical-align: top;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background-color: ${theme.primary}15; color: ${theme.primary}; font-size: 10px; font-weight: bold; width: 20px; height: 20px; text-align: center; border-radius: 4px; border: 1px solid ${theme.primary}30;">
                        ${idx + 1}
                      </td>
                      <td style="padding-left: 12px; font-size: 13px; color: #ddd; line-height: 1.4;">
                        ${r}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            `).join('')}
          </table>
        </div>

        <!-- ACTION BUTTONS -->
        <div style="margin-top: 40px; text-align: center;">
          <div style="margin-bottom: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: ${theme.textMuted};">Command Center Operations</div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center">
                <div style="display: inline-block;">
                  <a href="${updateUrl}" style="background-color: ${theme.primary}; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; display: inline-block; box-shadow: 0 4px 15px ${theme.primary}40;">
                    View Detailed Alert
                  </a>
                  <div style="margin-top: 20px;">
                    <a href="${updateUrl}" style="color: ${theme.text}; background-color: #111; border: 1px solid ${theme.border}; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-size: 11px; font-weight: bold; text-transform: uppercase; margin: 0 5px; display: inline-block;">Update</a>
                    <a href="${confirmUrl}" style="color: ${theme.text}; background-color: #111; border: 1px solid ${theme.border}; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-size: 11px; font-weight: bold; text-transform: uppercase; margin: 0 5px; display: inline-block;">Close</a>
                    <a href="${escalateUrl}" style="color: ${theme.primary}; background-color: #111; border: 1px solid ${theme.primary}30; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-size: 11px; font-weight: bold; text-transform: uppercase; margin: 0 5px; display: inline-block;">Escalate</a>
                  </div>
                </div>
              </td>
            </tr>
          </table>
        </div>

      </div>

      <!-- FOOTER -->
      <div style="background-color: #000; padding: 30px; border-top: 1px solid ${theme.border}; text-align: center;">
        <div style="font-size: 11px; font-weight: bold; color: ${theme.text}; margin-bottom: 10px; letter-spacing: 1px; text-transform: uppercase;">GuardianSOC Enterprise Edition</div>
        <div style="font-size: 10px; color: ${theme.textMuted}; line-height: 1.6; max-width: 450px; margin: 0 auto;">
          This is an automated security notification. This email and any attachments are confidential and intended solely for the use of the individual or entity to whom they are addressed. Unauthorized distribution is prohibited.
        </div>
        <div style="margin-top: 20px; font-size: 9px; font-weight: 800; color: ${theme.textMuted}; letter-spacing: 1px;">
          &copy; 2026 THREAT DEFENCE SYSTEMS • SECURITY OPERATIONS CENTER
        </div>
      </div>

    </div>
  </center>
</body>
</html>
      `,
      ...base,
    };
  }

  if (type === 'daily_digest') {
    return {
      subject: `📊 [DIGEST] Pending SOC tickets — ${incident.ticketNumber}`,
      body: `
        <div style="background-color: ${theme.bg}; color: ${theme.text}; padding: 40px; font-family: sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: ${theme.card}; border: 1px solid ${theme.border}; border-radius: 8px; padding: 30px;">
            <div style="font-size: 14px; font-weight: 800; color: ${theme.primary}; text-transform: uppercase; margin-bottom: 20px;">Daily Status Digest</div>
            <p style="font-size: 14px; line-height: 1.6; color: #ccc;">
              The following ticket remains in your queue and requires review:
            </p>
            <div style="background-color: #000; padding: 20px; border-radius: 6px; border-left: 4px solid ${severityColor}; margin-top: 20px;">
              <div style="font-weight: bold; font-size: 16px;">${incident.ticketNumber}</div>
              <div style="font-size: 12px; color: ${theme.textMuted}; margin-top: 4px;">${incident.alertName}</div>
              <div style="margin-top: 10px;">
                <span style="font-size: 10px; text-transform: uppercase; background-color: ${severityColor}20; color: ${severityColor}; padding: 2px 8px; border-radius: 4px; border: 1px solid ${severityColor}40;">${incident.severity}</span>
                <span style="font-size: 12px; color: #666; margin-left: 10px;">Node: ${incident.host}</span>
              </div>
            </div>
            <div style="margin-top: 30px;">
              <a href="${updateUrl}" style="background-color: ${theme.primary}; color: #ffffff; padding: 10px 20px; border-radius: 4px; text-decoration: none; font-size: 12px; font-weight: bold; display: inline-block;">Open Command Center</a>
            </div>
          </div>
        </div>
      `,
      ...base,
    };
  }

  return {
    subject: `⏳ [REMINDER] Action Required: ${incident.ticketNumber}`,
    body: `
      <div style="background-color: ${theme.bg}; color: ${theme.text}; padding: 40px; font-family: sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: ${theme.card}; border: 1px solid ${theme.border}; border-radius: 8px; padding: 30px;">
          <div style="font-size: 14px; font-weight: 800; color: ${theme.secondary}; text-transform: uppercase; margin-bottom: 20px;">Pending Action Reminder</div>
          <p style="font-size: 14px; line-height: 1.6; color: #ccc;">
            Ticket <strong>${incident.ticketNumber}</strong> has been pending for over 24 hours without a status update.
          </p>
          <div style="margin-top: 30px; border-top: 1px solid ${theme.border}; padding-top: 20px;">
            <a href="${updateUrl}" style="background-color: ${theme.primary}; color: #ffffff; padding: 10px 20px; border-radius: 4px; text-decoration: none; font-size: 12px; font-weight: bold; display: inline-block;">Update Ticket Now</a>
          </div>
        </div>
      </div>
    `,
    ...base,
  };
}
