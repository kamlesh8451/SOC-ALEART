import pool from '../src/config/db';

async function setupMailbox() {
  const settings = {
    host: 'imap.gmail.com',
    port: 993,
    ssl: true,
    username: 'socalert.mumbai@gmail.com',
    password: 'Test', // I'll use 'Test' as a placeholder or if it was the intended password
    poll_interval: 60,
    is_active: true
  };

  try {
    const exists = await pool.query('SELECT id FROM mailbox_settings LIMIT 1');
    if (exists.rows.length > 0) {
      await pool.query(
        'UPDATE mailbox_settings SET host=$1, port=$2, ssl=$3, username=$4, password=$5, poll_interval=$6, is_active=$7 WHERE id=$8',
        [settings.host, settings.port, settings.ssl, settings.username, settings.password, settings.poll_interval, settings.is_active, exists.rows[0].id]
      );
      console.log('Mailbox settings updated.');
    } else {
      await pool.query(
        'INSERT INTO mailbox_settings (host, port, ssl, username, password, poll_interval, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [settings.host, settings.port, settings.ssl, settings.username, settings.password, settings.poll_interval, settings.is_active]
      );
      console.log('Mailbox settings inserted.');
    }
  } catch (err) {
    console.error('Error setting up mailbox:', err);
  } finally {
    process.exit(0);
  }
}

setupMailbox();
