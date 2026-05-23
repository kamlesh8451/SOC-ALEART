import pool from '../src/config/db';

const schema = `
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    permissions TEXT[] NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    permissions TEXT[],
    password_hash TEXT,
    mfa_secret TEXT,
    last_login TIMESTAMP WITH TIME ZONE,
    failed_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assignment_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    keyword TEXT NOT NULL,
    matching_strategy TEXT DEFAULT 'contains',
    priority INTEGER DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    assign_to_team TEXT,
    assigned_to_user_id TEXT,
    assigned_to_user_name TEXT,
    severity_override TEXT,
    auto_sla_assignment BOOLEAN DEFAULT TRUE,
    escalation_policy TEXT,
    send_notifications BOOLEAN DEFAULT TRUE,
    conditions JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS sla_policies (
    id TEXT PRIMARY KEY,
    severity TEXT NOT NULL UNIQUE,
    response_time_hours INTEGER NOT NULL,
    resolution_time_hours INTEGER NOT NULL
);

INSERT INTO sla_policies (id, severity, response_time_hours, resolution_time_hours) VALUES
  ('sla-low', 'low', 72, 168),
  ('sla-medium', 'medium', 48, 96),
  ('sla-high', 'high', 24, 48),
  ('sla-critical', 'critical', 4, 12)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    ticket_number TEXT NOT NULL UNIQUE,
    alert_name TEXT NOT NULL,
    severity TEXT NOT NULL,
    host TEXT NOT NULL,
    description TEXT,
    detection_time BIGINT NOT NULL,
    sla_deadline BIGINT NOT NULL,
    status TEXT NOT NULL,
    owner_id TEXT,
    domain TEXT,
    evidence_url TEXT,
    extension_requested BOOLEAN DEFAULT FALSE,
    extension_reason TEXT,
    correlation_id TEXT,
    assigned_to TEXT,
    assigned_to_user_id TEXT,
    escalation_history JSONB DEFAULT '[]'::jsonb,
    sla_warning_sent BOOLEAN DEFAULT FALSE,
    sla_breached_sent BOOLEAN DEFAULT FALSE,
    notification_priority TEXT,
    source TEXT DEFAULT 'MANUAL',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    message_id TEXT NOT NULL,
    sender TEXT,
    subject TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_status TEXT DEFAULT 'PENDING',
    error_details TEXT,
    incident_id TEXT
);

CREATE TABLE IF NOT EXISTS email_message_registry (
    message_id TEXT PRIMARY KEY,
    subject_hash TEXT,
    sender TEXT,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_logs (
    id SERIAL PRIMARY KEY,
    incident_id TEXT,
    recipient TEXT,
    notification_type TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incident_attachments (
    id SERIAL PRIMARY KEY,
    incident_id TEXT,
    filename TEXT NOT NULL,
    path TEXT NOT NULL,
    mimetype TEXT,
    size INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mailbox_settings (
    id SERIAL PRIMARY KEY,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    ssl BOOLEAN DEFAULT TRUE,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    poll_interval INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    incident_id TEXT,
    ticket_number TEXT,
    details TEXT,
    timestamp BIGINT NOT NULL
);

-- Insert a default admin user if not exists
INSERT INTO roles (id, name, permissions, description)
VALUES ('admin', 'Administrator', ARRAY['all'], 'Full system access')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name, role, permissions, password_hash)
VALUES ('admin-01', 'admin@guardiansoc.local', 'System Admin', 'admin', ARRAY['all'], '$2b$10$okqTNgmorxoBONhfPM/Q1uMqBz.BAELpwzqw.sYF1U8v5yK.M8.VG')
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

INSERT INTO roles (id, name, permissions, description) VALUES
  ('soc_analyst', 'SOC Analyst', ARRAY['view_incidents','create_incident','update_incident'], 'Tier-1 analyst'),
  ('soc_lead', 'SOC Lead', ARRAY['view_incidents','create_incident','update_incident','escalate_incident'], 'Team lead'),
  ('domain_owner', 'Domain Owner', ARRAY['view_incidents','update_incident'], 'Domain responder'),
  ('manager', 'Manager', ARRAY['view_incidents','view_audit_logs'], 'Management oversight')
ON CONFLICT (id) DO NOTHING;

-- Insert default SOC Mailbox
INSERT INTO mailbox_settings (id, host, port, ssl, username, password, poll_interval, is_active)
VALUES (1, 'imap.gmail.com', 993, TRUE, 'socalert.mumbai@gmail.com', 'axlc anoh fizi xecz', 60, TRUE)
ON CONFLICT (id) DO UPDATE SET 
  host = EXCLUDED.host,
  port = EXCLUDED.port,
  ssl = EXCLUDED.ssl,
  username = EXCLUDED.username,
  password = EXCLUDED.password,
  poll_interval = EXCLUDED.poll_interval,
  is_active = EXCLUDED.is_active;

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_sla_deadline ON incidents(sla_deadline);
CREATE INDEX IF NOT EXISTS idx_incidents_host ON incidents(host);
CREATE INDEX IF NOT EXISTS idx_audit_logs_incident ON audit_logs(incident_id);
CREATE INDEX IF NOT EXISTS idx_rules_active_priority ON assignment_rules(active, priority DESC);

-- Ensure all columns exist in assignment_rules and fix constraints
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assignment_rules' AND column_name='name') THEN
        ALTER TABLE assignment_rules ADD COLUMN name TEXT NOT NULL DEFAULT 'Unnamed Rule';
    END IF;
    
    -- Fix existing NOT NULL constraints that shouldn't be there
    ALTER TABLE assignment_rules ALTER COLUMN assigned_to_user_id DROP NOT NULL;
    ALTER TABLE assignment_rules ALTER COLUMN assigned_to_user_name DROP NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assignment_rules' AND column_name='assign_to_team') THEN
        ALTER TABLE assignment_rules ADD COLUMN assign_to_team TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assignment_rules' AND column_name='severity_override') THEN
        ALTER TABLE assignment_rules ADD COLUMN severity_override TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assignment_rules' AND column_name='auto_sla_assignment') THEN
        ALTER TABLE assignment_rules ADD COLUMN auto_sla_assignment BOOLEAN DEFAULT TRUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assignment_rules' AND column_name='escalation_policy') THEN
        ALTER TABLE assignment_rules ADD COLUMN escalation_policy TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assignment_rules' AND column_name='send_notifications') THEN
        ALTER TABLE assignment_rules ADD COLUMN send_notifications BOOLEAN DEFAULT TRUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assignment_rules' AND column_name='conditions') THEN
        ALTER TABLE assignment_rules ADD COLUMN conditions JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Insert default assignment rules
INSERT INTO assignment_rules (id, name, keyword, matching_strategy, priority, active, severity_override, assigned_to_user_name)
VALUES 
  ('rule-01', 'Ransomware Detection', 'ransomware', 'contains', 100, TRUE, 'critical', 'SOC Lead'),
  ('rule-02', 'Phishing Alert', 'phishing', 'contains', 80, TRUE, 'high', 'SOC Analyst'),
  ('rule-03', 'Brute Force Attack', 'brute force', 'contains', 90, TRUE, 'high', 'SOC Analyst'),
  ('rule-04', 'Cobalt Strike Beacon', 'Cobalt Strike', 'contains', 110, TRUE, 'critical', 'System Admin'),
  ('rule-05', 'Malware Outbreak', 'malware', 'contains', 95, TRUE, 'critical', 'SOC Lead')
ON CONFLICT (id) DO NOTHING;
`;

async function initDb() {
  try {
    console.log('Connecting to PostgreSQL...');
    const client = await pool.connect();
    console.log('Connected. Running schema initialization...');
    await client.query(schema);
    console.log('Schema initialization complete.');
    client.release();
    process.exit(0);
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }
}

initDb();
