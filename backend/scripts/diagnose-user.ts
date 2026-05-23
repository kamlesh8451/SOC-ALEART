import pool from '../src/config/db';

async function diagnose() {
  try {
    const result = await pool.query('SELECT id, email, name, role, password_hash FROM users WHERE email = $1', ['admin@guardiansoc.local']);
    
    if (result.rows.length === 0) {
      console.log('[DIAG] User admin@guardiansoc.local NOT FOUND in database.');
      
      const allUsers = await pool.query('SELECT email FROM users');
      console.log('[DIAG] Available users in DB:', allUsers.rows.map(u => u.email));
    } else {
      const user = result.rows[0];
      console.log('[DIAG] User found:');
      console.log(`[DIAG] ID: ${user.id}`);
      console.log(`[DIAG] Email: ${user.email}`);
      console.log(`[DIAG] Name: ${user.name}`);
      console.log(`[DIAG] Role: ${user.role}`);
      console.log(`[DIAG] Hash: ${user.password_hash}`);
    }
    process.exit(0);
  } catch (err) {
    console.error('[DIAG] Database error:', err);
    process.exit(1);
  }
}

diagnose();
