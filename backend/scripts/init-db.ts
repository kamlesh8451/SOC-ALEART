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
    acknowledged_at BIGINT,
    resolved_at BIGINT,
    escalation_history JSONB DEFAULT '[]'::jsonb,
    sla_warning_sent BOOLEAN DEFAULT FALSE,
    sla_breached_sent BOOLEAN DEFAULT FALSE,
    notification_priority TEXT,
    source TEXT DEFAULT 'MANUAL',
    metadata JSONB DEFAULT '{}'::jsonb,
    closure_comment TEXT,
    root_cause TEXT,
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
    is_active BOOLEAN DEFAULT TRUE,
    spam_filters JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS feature_flags (
    name TEXT PRIMARY KEY,
    is_enabled BOOLEAN DEFAULT FALSE,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO feature_flags (name, is_enabled, description)
VALUES 
  ('graph_intelligence', TRUE, 'Visual link analysis of hosts, IPs, and related incidents'),
  ('widget_active_threats', TRUE, 'Show Active Threats (Open + Investigating) count on dashboard'),
  ('widget_open_matrix', TRUE, 'Show the entire Live Exposure Matrix (Open) section'),
  ('widget_closed_matrix', TRUE, 'Show the entire Neutralization History (Closed) section'),
  ('widget_mtta', TRUE, 'Show Mean Time to Acknowledge (MTTA) on dashboard'),
  ('widget_mttr', TRUE, 'Show Mean Time to Resolve (MTTR) on dashboard'),
  ('widget_closed_total', TRUE, 'Show total closed tickets count on dashboard'),
  ('widget_critical_closed', TRUE, 'Show critical closed tickets count on dashboard'),
  ('widget_high_closed', TRUE, 'Show high closed tickets count on dashboard'),
  ('widget_medium_closed', TRUE, 'Show medium closed tickets count on dashboard'),
  ('widget_low_closed', TRUE, 'Show low closed tickets count on dashboard'),
  ('widget_critical_open', TRUE, 'Show critical open tickets count on dashboard'),
  ('widget_high_open', TRUE, 'Show high open tickets count on dashboard'),
  ('widget_medium_open', TRUE, 'Show medium open tickets count on dashboard'),
  ('widget_low_open', TRUE, 'Show low open tickets count on dashboard')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    incident_id TEXT,
    ticket_number TEXT,
    details TEXT,
    timestamp BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info',
    read BOOLEAN DEFAULT FALSE,
    link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_stats_mv AS
SELECT 
  COUNT(*) FILTER (WHERE TRIM(status) ILIKE 'open') as open_count,
  COUNT(*) FILTER (WHERE TRIM(status) ILIKE 'investigating') as investigating_count,
  COUNT(*) FILTER (WHERE TRIM(status) ILIKE 'closed') as closed_count,
  
  COUNT(*) FILTER (WHERE TRIM(severity) ILIKE 'critical' AND TRIM(status) NOT ILIKE 'closed') as critical_open,
  COUNT(*) FILTER (WHERE TRIM(severity) ILIKE 'high' AND TRIM(status) NOT ILIKE 'closed') as high_open,
  COUNT(*) FILTER (WHERE (TRIM(severity) ILIKE 'medium' OR TRIM(severity) ILIKE 'TEST') AND TRIM(status) NOT ILIKE 'closed') as medium_open,
  COUNT(*) FILTER (WHERE TRIM(severity) ILIKE 'low' AND TRIM(status) NOT ILIKE 'closed') as low_open,
  
  COUNT(*) FILTER (WHERE TRIM(severity) ILIKE 'critical' AND TRIM(status) ILIKE 'closed') as critical_closed,
  COUNT(*) FILTER (WHERE TRIM(severity) ILIKE 'high' AND TRIM(status) ILIKE 'closed') as high_closed,
  COUNT(*) FILTER (WHERE (TRIM(severity) ILIKE 'medium' OR TRIM(severity) ILIKE 'TEST') AND TRIM(status) ILIKE 'closed') as medium_closed,
  COUNT(*) FILTER (WHERE TRIM(severity) ILIKE 'low' AND TRIM(status) ILIKE 'closed') as low_closed,
  
  COUNT(*) FILTER (WHERE TRIM(status) NOT ILIKE 'closed') as active_threats,
  COUNT(*) as total_count
FROM incidents;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_stats_mv_total ON dashboard_stats_mv (total_count);

-- Insert a default admin user if not exists
INSERT INTO roles (id, name, permissions, description)
VALUES ('admin', 'Administrator', ARRAY['all'], 'Full system access')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name, role, permissions, password_hash)
VALUES ('admin-01', 'admin@guardiansoc.local', 'System Admin', 'admin', ARRAY['all'], '$2b$10$okqTNgmorxoBONhfPM/Q1uMqBz.BAELpwzqw.sYF1U8v5yK.M8.VG')
ON CONFLICT (id) DO NOTHING;

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

    -- Ensure incidents table has new closure columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='closure_comment') THEN
        ALTER TABLE incidents ADD COLUMN closure_comment TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='root_cause') THEN
        ALTER TABLE incidents ADD COLUMN root_cause TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='created_at') THEN
        ALTER TABLE incidents ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='updated_at') THEN
        ALTER TABLE incidents ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mailbox_settings' AND column_name='spam_filters') THEN
        ALTER TABLE mailbox_settings ADD COLUMN spam_filters JSONB DEFAULT '[]'::jsonb;
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
