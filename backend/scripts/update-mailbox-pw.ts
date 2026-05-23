import pool from '../src/config/db';

async function updatePassword() {
  const password = 'eabj byrb dfxh svgl';
  try {
    const res = await pool.query('UPDATE mailbox_settings SET password = $1, is_active = TRUE WHERE username = $2', [password, 'socalert.mumbai@gmail.com']);
    if (res.rowCount === 0) {
      // If for some reason the username doesn't match, just update the first one
      await pool.query('UPDATE mailbox_settings SET password = $1, is_active = TRUE LIMIT 1', [password]);
    }
    console.log('Mailbox password updated successfully.');
  } catch (err) {
    console.error('Error updating password:', err);
  } finally {
    process.exit(0);
  }
}

updatePassword();
