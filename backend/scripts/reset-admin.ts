import pool from '../src/config/db';
import bcrypt from 'bcrypt';

async function reset() {
  try {
    const pass = 'Admin@123';
    const hash = await bcrypt.hash(pass, 10);
    console.log(`[SYS] Resetting admin password to: ${pass}`);
    
    await pool.query(
      "UPDATE users SET password_hash = $1 WHERE email IN ($2, $3, $4)",
      [hash, 'admin@guardiansoc.local', 'kamleshgawade786@gmail.com', 'kamleshgawde1@gmail.com']
    );
    
    // Also ensure the user exists and has correct permissions
    await pool.query(
      `INSERT INTO users (id, email, name, role, permissions, password_hash) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (email) DO UPDATE SET 
         password_hash = EXCLUDED.password_hash,
         permissions = EXCLUDED.permissions,
         role = EXCLUDED.role`,
      ['admin-kamlesh-1', 'kamleshgawde1@gmail.com', 'Kamlesh Admin', 'admin', ['all'], hash]
    );
    
    console.log('[SYS] Admin password successfully reset and user verified.');
    process.exit(0);
  } catch (err) {
    console.error('[ERR] Failed to reset admin password:', err);
    process.exit(1);
  }
}

reset();
