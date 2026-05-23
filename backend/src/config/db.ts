import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Support for ESM and CJS bundling
const getProjectRoot = () => {
  try {
    if (typeof __dirname !== 'undefined') {
      return path.resolve(__dirname, '../../..');
    }
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  } catch (e) {
    return process.cwd(); // Final fallback
  }
};

const projectRoot = getProjectRoot();

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

  // Use rejectUnauthorized: false ONLY if explicitly forced by the env var, otherwise default to true for security.
  const sslConfig = needsSsl 
    ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false' ? false : true } 
    : undefined;

  return {
    connectionString,
    ssl: sslConfig,
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
