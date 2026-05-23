import pool from '../src/config/db';

async function checkLogs() {
  try {
    const res = await pool.query('SELECT * FROM email_logs ORDER BY received_at DESC LIMIT 10');
    console.log('--- LATEST EMAIL LOGS ---');
    console.table(res.rows);
    
    const settings = await pool.query('SELECT username, is_active FROM mailbox_settings');
    console.log('\n--- MAILBOX SETTINGS ---');
    console.table(settings.rows);

    const incidents = await pool.query('SELECT ticket_number, alert_name, source FROM incidents ORDER BY created_at DESC LIMIT 5');
    console.log('\n--- LATEST INCIDENTS ---');
    console.table(incidents.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkLogs();
