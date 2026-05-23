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
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
};

const backendRoot = getBackendRoot();
const projectRoot = path.resolve(backendRoot, '..');

dotenv.config({ path: path.join(backendRoot, '.env') });

// Force allow self-signed certs for Aiven/Local dev
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

app.use('/uploads', express.static(path.join(backendRoot, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/incidents', authenticate, incidentRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/roles', authenticate, roleRoutes);
app.use('/api/rules', authenticate, ruleRoutes);
app.use('/api/audit-logs', authenticate, auditRoutes);
app.use('/api/tickets', authenticate, ticketRoutes);
app.use('/api/mail', authenticate, mailRoutes);

app.post('/api/notifications/simulate-email', (req, res) => {
  try {
    const { incident, type } = req.body;
    const email = buildNotificationEmail(incident, type || 'alert');
    res.json(email);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Notification failed';
    res.status(400).json({ error: message });
  }
});

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
    await pool.query("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS assigned_to_user_id TEXT");
    await pool.query("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'MANUAL'");
    await pool.query("ALTER TABLE incidents ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb");
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
    await ensureSchemaCompatibility();
    slaService.startMonitor();
    EmailIngestionService.start();
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
