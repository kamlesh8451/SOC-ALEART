import pool from '../src/config/db';

async function fixSchema() {
  try {
    console.log('Connecting to fix schema...');
    
    // Check if source column exists in incidents
    const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'incidents' AND column_name = 'source'
    `);

    if (res.rows.length === 0) {
      console.log('Adding "source" and "metadata" columns to incidents table...');
      await pool.query('ALTER TABLE incidents ADD COLUMN IF NOT EXISTS source TEXT DEFAULT \'MANUAL\'');
      await pool.query('ALTER TABLE incidents ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT \'{}\'::jsonb');
    }

    const assignedToUserColumn = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'incidents' AND column_name = 'assigned_to_user_id'
    `);

    if (assignedToUserColumn.rows.length === 0) {
      console.log('Adding "assigned_to_user_id" column to incidents table...');
      await pool.query('ALTER TABLE incidents ADD COLUMN IF NOT EXISTS assigned_to_user_id TEXT');
    }

    // Ensure email_logs table has correct columns if it was created partially
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
          id SERIAL PRIMARY KEY,
          message_id TEXT NOT NULL,
          sender TEXT,
          subject TEXT,
          received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          processed_status TEXT DEFAULT 'PENDING',
          error_details TEXT,
          incident_id TEXT
      )
    `);

    console.log('Schema fix complete.');
  } catch (err) {
    console.error('Error fixing schema:', err);
  } finally {
    process.exit(0);
  }
}

fixSchema();
