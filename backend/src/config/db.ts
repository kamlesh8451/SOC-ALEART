import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');

dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({ path: path.join(projectRoot, 'backend', '.env') });

const { Pool } = pg;

function buildPoolConfig() {
  const raw = process.env.DATABASE_URL || '';
  if (!raw) {
    console.error(
      '[ERR] DATABASE_URL is not set. Copy .env.example to .env in the project root.'
    );
    return { connectionString: undefined, ssl: undefined };
  }

  const needsSsl =
    raw.includes('sslmode=require') ||
    raw.includes('aivencloud.com') ||
    process.env.DATABASE_SSL === 'true';

  let connectionString = raw;
  try {
    const normalized = raw.replace(/^postgres:\/\//, 'postgresql://');
    const url = new URL(normalized);
    url.searchParams.delete('sslmode');
    connectionString = url.toString().replace(/^postgresql:\/\//, 'postgres://');
  } catch {
    connectionString = raw.replace(/[?&]sslmode=require/g, '');
  }

  return {
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  };
}

const pool = new Pool(buildPoolConfig());

pool.on('error', (err) => {
  console.error('[ERR] Unexpected database pool error:', err.message);
});

export async function testConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

export default pool;
