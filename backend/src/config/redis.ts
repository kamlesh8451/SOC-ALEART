import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
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
dotenv.config({ path: path.join(_dirname, '../../../.env') });

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
  // Completely silent retry strategy
  retryStrategy: (times: number) => {
    return 15000; // Retry every 15 seconds
  },
  enableOfflineQueue: false, // Don't queue commands if Redis is down
  connectTimeout: 2000,      // Fail fast
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  }
};

export const redisConnection = new Redis(redisConfig);

// Suppress error logs to keep console clean
let lastWarned = 0;
redisConnection.on('error', (err: any) => {
  const now = Date.now();
  // Only log a quiet warning once per minute
  if (now - lastWarned > 60000) {
    if (err.code === 'ECONNREFUSED') {
      console.warn('[REDIS] Background services are offline (Redis connection refused). This is expected if Redis is not installed.');
    } else {
      console.warn(`[REDIS] Connection issue: ${err.message}`);
    }
    lastWarned = now;
  }
});

redisConnection.on('connect', () => {
  console.log('[REDIS] Connected successfully');
});
