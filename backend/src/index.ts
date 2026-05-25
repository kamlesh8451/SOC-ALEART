import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { testConnection } from './config/db';
import authRoutes from './routes/authRoutes';
import incidentRoutes from './routes/incidentRoutes';
import userRoutes from './routes/userRoutes';
import roleRoutes from './routes/roleRoutes';
import ruleRoutes from './routes/ruleRoutes';
import auditRoutes from './routes/auditRoutes';
import ticketRoutes from './routes/ticketRoutes';
import mailRoutes from './routes/mailRoutes';
import settingsRoutes from './routes/settingsRoutes';
import reportRoutes from './routes/reportRoutes';
import slaRoutes from './routes/slaRoutes';
import notificationRoutes from './routes/notificationRoutes';
import emailTemplateRoutes from './routes/emailTemplateRoutes';
import { errorHandler, authenticate } from './middleware/auth';
import { slaService } from './services/slaService';
import { EmailIngestionService } from './services/EmailIngestionService';
import { buildNotificationEmail } from './services/notificationService';
import { queueService } from './services/queueService';
import { createServer } from 'http';
import { SocketService } from './services/SocketService';

// Support for ESM and CJS bundling
const getBackendRoot = () => {
  if (typeof __dirname !== 'undefined') {
    // CJS (Production bundled)
    return path.resolve(__dirname, '..');
  }
  // ESM (Development/tsx)
  try {
    // @ts-ignore - import.meta is available in ESM
    const url = import.meta.url;
    if (url) return path.resolve(path.dirname(fileURLToPath(url)), '..');
  } catch (e) {
    // Fallback if import.meta is not available or throws
  }
  return process.cwd();
};

const backendRoot = getBackendRoot();
const projectRoot = path.resolve(backendRoot, '..');

dotenv.config({ path: path.join(backendRoot, '.env') });

// Force allow self-signed certs for Aiven/Local dev only
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const app = express();
const PORT = process.env.PORT || 3001;
const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

const allowedOrigins = [frontendOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'];

app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' ? true : (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(express.json());

// Request logger to debug 500 errors
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[REQ] ${req.method} ${req.url}`);
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[RES] ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`);
  });
  next();
});

app.use('/uploads', express.static(path.join(backendRoot, 'uploads')));

app.use('/api/templates', authenticate, emailTemplateRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/incidents', authenticate, incidentRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/roles', authenticate, roleRoutes);
app.use('/api/rules', authenticate, ruleRoutes);
app.use('/api/audit-logs', authenticate, auditRoutes);
app.use('/api/tickets', authenticate, ticketRoutes);
app.use('/api/mail', authenticate, mailRoutes);
app.use('/api/settings', authenticate, settingsRoutes);
app.use('/api/reports', authenticate, reportRoutes);
app.use('/api/sla', authenticate, slaRoutes);
app.use('/api/notifications', authenticate, notificationRoutes);

app.get('/api/health', async (_req, res) => {
  try {
    await testConnection();
    const count = await pool.query('SELECT COUNT(*)::int AS n FROM incidents');
    res.json({
      status: 'ok',
      database: 'postgresql',
      incidents: count.rows[0].n,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database unavailable';
    res.status(503).json({ status: 'error', database: 'postgresql', error: message });
  }
});

const distPath = path.join(projectRoot, 'frontend', 'dist');
const distIndex = path.join(distPath, 'index.html');
if (process.env.SERVE_FRONTEND !== 'false' && fs.existsSync(distIndex)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(distIndex);
  });
}

app.use(errorHandler);

// Catch-all 404 for API
app.use('/api', (req, res) => {
  console.log(`[404] No route matched for ${req.method} ${req.url}`);
  res.status(404).json({ error: `Path ${req.url} not found` });
});

async function ensureSchemaCompatibility() {
  try {
    // Incidents updates
    await pool.query("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS assigned_to_user_id TEXT");
    await pool.query("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'MANUAL'");
    await pool.query("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb");
    await pool.query("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS acknowledged_at BIGINT");
    await pool.query("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS resolved_at BIGINT");
    
    // Ensure ai_insights is JSONB
    const checkAiInsights = await pool.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'ai_insights'");
    if (checkAiInsights.rows.length > 0 && checkAiInsights.rows[0].data_type === 'text') {
      console.log('[SYS] Converting incidents.ai_insights from TEXT to JSONB...');
      await pool.query("ALTER TABLE incidents ALTER COLUMN ai_insights TYPE JSONB USING ai_insights::jsonb");
    } else {
      await pool.query("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS ai_insights JSONB");
    }
    
    await pool.query("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS closure_comment TEXT");
    await pool.query("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS root_cause TEXT");
    
    // Assignment Rules updates
    await pool.query("ALTER TABLE assignment_rules ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Unnamed Rule'");
    await pool.query("ALTER TABLE assignment_rules ALTER COLUMN assigned_to_user_id DROP NOT NULL");
    await pool.query("ALTER TABLE assignment_rules ALTER COLUMN assigned_to_user_name DROP NOT NULL");
    await pool.query("ALTER TABLE assignment_rules ADD COLUMN IF NOT EXISTS assign_to_team TEXT");
    await pool.query("ALTER TABLE assignment_rules ADD COLUMN IF NOT EXISTS severity_override TEXT");
    await pool.query("ALTER TABLE assignment_rules ADD COLUMN IF NOT EXISTS auto_sla_assignment BOOLEAN DEFAULT TRUE");
    await pool.query("ALTER TABLE assignment_rules ADD COLUMN IF NOT EXISTS escalation_policy TEXT");
    await pool.query("ALTER TABLE assignment_rules ADD COLUMN IF NOT EXISTS send_notifications BOOLEAN DEFAULT TRUE");
    await pool.query("ALTER TABLE assignment_rules ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '[]'::jsonb");
    await pool.query("ALTER TABLE assignment_rules ADD COLUMN IF NOT EXISTS matching_strategy TEXT DEFAULT 'contains'");

    await pool.query("ALTER TABLE mailbox_settings ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE");
    await pool.query("ALTER TABLE mailbox_settings ADD COLUMN IF NOT EXISTS last_sync_status TEXT DEFAULT 'UNKNOWN'");
    await pool.query("ALTER TABLE mailbox_settings ADD COLUMN IF NOT EXISTS last_error TEXT");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default templates if they don't exist
    const defaultTemplates = [
      {
        id: 'incident_alert',
        name: 'New Incident Alert',
        subject: '🚨 SOC ALERT: {{ticketNumber}} - {{severity}} Priority',
        body: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b; background: #f8fafc;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
              <div style="background: #0f172a; color: #ffffff; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">GuardianSOC</h1>
                <p style="margin: 5px 0 0; font-size: 12px; opacity: 0.7;">SECURITY OPERATIONS CENTER</p>
              </div>
              <div style="padding: 30px;">
                <h2 style="margin: 0 0 20px; font-size: 18px; color: #ef4444;">NEW TACTICAL ALERT DETECTED</h2>
                <div style="background: #f1f5f9; padding: 20px; border-radius: 6px; margin-bottom: 25px;">
                  <p style="margin: 0 0 10px;"><strong>TICKET:</strong> {{ticketNumber}}</p>
                  <p style="margin: 0 0 10px;"><strong>ALERT:</strong> {{alertName}}</p>
                  <p style="margin: 0 0 10px;"><strong>SEVERITY:</strong> <span style="color: #ef4444; font-weight: bold;">{{severity}}</span></p>
                  <p style="margin: 0;"><strong>TARGET:</strong> {{host}}</p>
                </div>
                <div style="margin-bottom: 25px;">
                  <h3 style="font-size: 14px; margin: 0 0 10px;">TACTICAL NARRATIVE</h3>
                  <p style="font-size: 14px; color: #475569; line-height: 1.6;">{{description}}</p>
                </div>
                <a href="{{appUrl}}/incidents?id={{incidentId}}" style="display: inline-block; background: #3b82f6; color: #ffffff; padding: 12px 25px; border-radius: 4px; text-decoration: none; font-weight: bold; font-size: 14px;">INVESTIGATE NOW</a>
              </div>
              <div style="background: #f8fafc; padding: 15px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">
                This is an automated operational communication. Do not reply directly to this node.
              </div>
            </div>
          </div>
        `
      }
    ];

    for (const template of defaultTemplates) {
      await pool.query(
        'INSERT INTO email_templates (id, name, subject, body) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [template.id, template.name, template.subject, template.body]
      );
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        incident_id TEXT,
        ticket_number TEXT,
        details TEXT,
        timestamp BIGINT NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS feature_flags (
        name TEXT PRIMARY KEY,
        is_enabled BOOLEAN DEFAULT FALSE,
        description TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      INSERT INTO feature_flags (name, is_enabled, description)
      VALUES ('graph_intelligence', TRUE, 'Visual link analysis of hosts, IPs, and related incidents')
      ON CONFLICT (name) DO NOTHING
    `);

    console.log('[SYS] Database schema compatibility checks completed');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ERR] Schema compatibility check failed:', message);
    throw err;
  }
}

async function startServer() {
  if (!process.env.DATABASE_URL) {
    console.error('[ERR] DATABASE_URL is missing. Copy .env.example to .env and set your Aiven connection string.');
    process.exit(1);
  }

  try {
    await testConnection();
    console.log('[SYS] PostgreSQL connection verified');
    if (process.env.NODE_ENV !== 'production' || process.env.RUN_MIGRATIONS === 'true') {
      await ensureSchemaCompatibility();
    } else {
      console.log('[SYS] Skipping automatic schema migrations in production.');
    }
    
    // Automation Engine handles background task orchestration
    await queueService.init();

    const httpServer = createServer(app);
    SocketService.init(httpServer);

    const BIND_IP = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';

    httpServer.listen(PORT, BIND_IP, () => {
      console.log(`[SYS] GuardianSOC API on http://${BIND_IP === '0.0.0.0' ? 'EC2-IP' : '127.0.0.1'}:${PORT}`);
      console.log(`[SYS] Frontend Origin: ${frontendOrigin}`);
    });

    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[ERR] Port ${PORT} is already in use.`);
      } else {
        console.error('[ERR] Server failed to start:', err.message);
      }
      process.exit(1);
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ERR] Database connection failed:', message);
    process.exit(1);
  }
}

startServer();
