import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { EmailIngestionService } from './EmailIngestionService';
import { slaService } from './slaService';

// Queues
export const emailQueue = new Queue('email-ingestion', { connection: redisConnection });
export const slaQueue = new Queue('sla-monitor', { connection: redisConnection });
export const notificationQueue = new Queue('notifications', { connection: redisConnection });

// Workers
export const emailWorker = new Worker(
  'email-ingestion',
  async (job: Job) => {
    console.log(`[WORKER] Processing email ingestion job ${job.id}`);
    await EmailIngestionService.processAllMailboxes();
  },
  { connection: redisConnection }
);

export const slaWorker = new Worker(
  'sla-monitor',
  async (job: Job) => {
    console.log(`[WORKER] Processing SLA monitor job ${job.id}`);
    await slaService.checkSLAs();
  },
  { connection: redisConnection }
);

// Error handlers
emailWorker.on('failed', (job, err) => {
  console.error(`[WORKER] Email ingestion job ${job?.id} failed:`, err);
});

slaWorker.on('failed', (job, err) => {
  console.error(`[WORKER] SLA monitor job ${job?.id} failed:`, err);
});

export const queueService = {
  async init() {
    console.log('[SYS] Initializing BullMQ queues...');
    
    // We wrap the initialization in a non-blocking promise so it doesn't hang the server startup
    // if Redis is unavailable.
    const initTask = async () => {
      try {
        // Use a timeout for the initial connection check/job addition
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
        );

        const setupPromise = (async () => {
          // Add repeatable jobs
          await emailQueue.add('poll-emails', {}, {
            repeat: { every: 60000 } // Every 60 seconds
          });

          await slaQueue.add('check-sla', {}, {
            repeat: { every: 60000 } // Every 60 seconds
          });
          return true;
        })();

        await Promise.race([setupPromise, timeoutPromise]);
        console.log('[SYS] BullMQ Repeatable Jobs initialized');
      } catch (err: any) {
        console.warn(`[SYS] BullMQ initialization failed: ${err.message}. Background tasks will not run via BullMQ.`);
        console.log('[SYS] Starting automation fallback engine (Standard Interval)...');
        
        // Fallback: Start a standard interval timer to ensure automation runs even without Redis
        setInterval(async () => {
          try {
            console.log('[FALLBACK] Triggering automated email ingestion check...');
            await EmailIngestionService.processAllMailboxes();
          } catch (e: any) {
            console.error('[FALLBACK] Email ingestion check failed:', e.message);
          }
        }, 60000); // 60 seconds

        setInterval(async () => {
          try {
            await slaService.checkSLAs();
          } catch (e: any) {
            console.error('[FALLBACK] SLA check failed:', e.message);
          }
        }, 120000); // 120 seconds for SLAs
      }
    };

    // Run initialization in background
    initTask();
  }
};
