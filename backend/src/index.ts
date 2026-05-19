import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import pool from './config/db';
import incidentRoutes from './routes/incidentRoutes';
import userRoutes from './routes/userRoutes';
import roleRoutes from './routes/roleRoutes';
import ruleRoutes from './routes/ruleRoutes';
import auditRoutes from './routes/auditRoutes';
import ticketRoutes from './routes/ticketRoutes';
import { errorHandler } from './middleware/auth';
import { slaService } from './services/slaService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/incidents', incidentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/rules', ruleRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/tickets', ticketRoutes);

// Additional endpoints
app.post("/api/notifications/simulate-email", (req, res) => {
  const { incident, type } = req.body;
  const isCritical = incident.severity === 'critical' || incident.severity === 'high';
  res.json({ subject: `[SIMULATED] ${incident.ticketNumber}`, body: "Email body content" });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: 'postgresql' });
});

async function startServer() {
  // Start Background Services
  slaService.startMonitor();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Error handling should be last
  app.use(errorHandler);

  app.listen(PORT, () => {
    console.log(`[SYS] GuardianSOC backend modularized. Running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[ERR] Failed to start server:', err);
});
