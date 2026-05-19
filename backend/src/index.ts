import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { testConnection } from './config/db';
import incidentRoutes from './routes/incidentRoutes';
import userRoutes from './routes/userRoutes';
import roleRoutes from './routes/roleRoutes';
import ruleRoutes from './routes/ruleRoutes';
import auditRoutes from './routes/auditRoutes';
import ticketRoutes from './routes/ticketRoutes';
import { errorHandler } from './middleware/auth';
import { slaService } from './services/slaService';
import { buildNotificationEmail } from './services/notificationService';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({ path: path.join(projectRoot, 'backend', '.env') });

// Force allow self-signed certs for Aiven/Local dev
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const PORT = process.env.PORT || 3001;
const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' ? true : frontendOrigin,
    credentials: true,
  })
);
app.use(express.json());

// Request logger to debug 500 errors
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

app.use('/uploads', express.static(path.join(projectRoot, 'backend', 'uploads')));

app.use('/api/incidents', incidentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/rules', ruleRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/tickets', ticketRoutes);

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

async function startServer() {
  if (!process.env.DATABASE_URL) {
    console.error('[ERR] DATABASE_URL is missing. Copy .env.example to .env and set your Aiven connection string.');
    process.exit(1);
  }

  try {
    await testConnection();
    console.log('[SYS] PostgreSQL connection verified');
    slaService.startMonitor();

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[SYS] GuardianSOC API on http://localhost:${PORT}`);
      console.log(`[SYS] Frontend (dev): ${frontendOrigin}`);
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
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
