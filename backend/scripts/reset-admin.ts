import pool from '../src/config/db';
import bcrypt from 'bcrypt';

async function reset() {
  try {
    const pass = 'admin123';
    const hash = await bcrypt.hash(pass, 10);
    console.log(`[SYS] Resetting admin password to: ${pass}`);
    
    await pool.query(
      "UPDATE users SET password_hash = $1 WHERE email IN ($2, $3)",
      [hash, 'admin@guardiansoc.local', 'kamleshgawade786@gmail.com']
    );
    
    console.log('[SYS] Admin password successfully reset.');
    process.exit(0);
  } catch (err) {
    console.error('[ERR] Failed to reset admin password:', err);
    process.exit(1);
  }
}

reset();
