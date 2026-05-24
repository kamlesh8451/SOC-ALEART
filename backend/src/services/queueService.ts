import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { EmailIngestionService } from './EmailIngestionService';
import { slaService } from './slaService';

/**
 * BullMQ Integration Service
 * This service manages background jobs via Redis.
 * If Redis is unavailable, it gracefully fails and triggers a standard interval-based fallback.
 */

// Global references to prevent GC and allow shutdown
let emailQueue: Queue | null = null;
let slaQueue: Queue | null = null;
let notificationQueue: Queue | null = null;
let emailWorker: Worker | null = null;
let slaWorker: Worker | null = null;

function startFallbackTimers() {
  // Prevent multiple fallback instances
  if ((global as any).__gsoc_fallback_active) return;
  (global as any).__gsoc_fallback_active = true;

  console.log('[SYS] Starting automation fallback engine (Standard Interval)...');

  // Email Ingestion Fallback (Every 60s)
  setInterval(async () => {
    try {
      await EmailIngestionService.processAllMailboxes();
    } catch (e: any) {
      console.error('[FALLBACK] Email ingestion failed:', e.message);
    }
  }, 60000);

  // SLA Monitoring Fallback (Every 120s)
  setInterval(async () => {
    try {
      await slaService.checkSLAs();
    } catch (e: any) {
      console.error('[FALLBACK] SLA check failed:', e.message);
    }
  }, 120000);
  
  console.log('[SYS] Fallback timers active (No Redis dependency)');
}

export const queueService = {
  async init() {
    console.log('[SYS] Initializing Automation Engine...');

    try {
      // 1. Check if Redis is reachable before doing anything else
      const isRedisUp = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 2000);

        redisConnection.ping()
          .then(() => {
            clearTimeout(timeout);
            resolve(true);
          })
          .catch(() => {
            clearTimeout(timeout);
            resolve(false);
          });
      });

      if (!isRedisUp) {
        throw new Error('Redis not reachable');
      }

      // 2. Initialize Queues
      emailQueue = new Queue('email-ingestion', { connection: redisConnection });
      slaQueue = new Queue('sla-monitor', { connection: redisConnection });
      notificationQueue = new Queue('notifications', { connection: redisConnection });

      [emailQueue, slaQueue, notificationQueue].forEach(q => {
        q.on('error', (err) => console.error(`[QUEUE] ${q.name} error:`, err.message));
      });

      // 3. Initialize Workers
      emailWorker = new Worker(
        'email-ingestion',
        async (job: Job) => {
          console.log(`[WORKER] Processing email ingestion job ${job.id}`);
          await EmailIngestionService.processAllMailboxes();
        },
        { connection: redisConnection }
      );

      slaWorker = new Worker(
        'sla-monitor',
        async (job: Job) => {
          console.log(`[WORKER] Processing SLA monitor job ${job.id}`);
          await slaService.checkSLAs();
        },
        { connection: redisConnection }
      );

      [emailWorker, slaWorker].forEach(w => {
        w.on('error', (err) => console.error(`[WORKER] ${w.name} system error:`, err.message));
        w.on('failed', (job, err) => console.error(`[WORKER] ${w.name} job ${job?.id} failed:`, err));
      });

      // 4. Schedule Repeatable Jobs
      await emailQueue.add('poll-emails', {}, { repeat: { every: 60000 } });
      await slaQueue.add('check-sla', {}, { repeat: { every: 60000 } });

      console.log('[SYS] BullMQ Repeatable Jobs initialized successfully');
    } catch (err: any) {
      console.warn(`[SYS] BullMQ suppressed: ${err.message || 'Redis Offline'}.`);
      startFallbackTimers();
    }
  }
};
