import { ImapFlow } from 'imapflow';

async function testConnection() {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: 'socalert.mumbai@gmail.com',
      pass: 'axlc anoh fizi xecz'
    },
    logger: false
  });

  try {
    console.log('[TEST] Attempting to connect to Gmail IMAP...');
    await client.connect();
    console.log('[SUCCESS] Connection established successfully!');
    await client.logout();
  } catch (err: any) {
    console.error('[FAILED] Connection failed:', err.message);
    console.log('\nPossible reasons:');
    console.log('1. IMAP is disabled in Gmail settings.');
    console.log('2. "Less secure app access" is off (not applicable for App Passwords).');
    console.log('3. The App Password is incorrect.');
    console.log('4. Two-Factor Authentication is not enabled (required for App Passwords).');
  }
}

testConnection();
