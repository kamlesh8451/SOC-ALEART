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
    permissions TEXT[]
);

CREATE TABLE IF NOT EXISTS assignment_rules (
    id TEXT PRIMARY KEY,
    keyword TEXT NOT NULL,
    assigned_to_user_id TEXT NOT NULL,
    assigned_to_user_name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    matching_strategy TEXT DEFAULT 'exact',
    priority INTEGER DEFAULT 0
);

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
    escalation_history JSONB DEFAULT '[]'::jsonb,
    sla_warning_sent BOOLEAN DEFAULT FALSE,
    sla_breached_sent BOOLEAN DEFAULT FALSE,
    notification_priority TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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

INSERT INTO users (id, email, name, role, permissions)
VALUES ('admin-01', 'admin@guardiansoc.local', 'System Admin', 'admin', ARRAY['all'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO roles (id, name, permissions, description) VALUES
  ('soc_analyst', 'SOC Analyst', ARRAY['view_incidents','create_incident','update_incident'], 'Tier-1 analyst'),
  ('soc_lead', 'SOC Lead', ARRAY['view_incidents','create_incident','update_incident','escalate_incident'], 'Team lead'),
  ('domain_owner', 'Domain Owner', ARRAY['view_incidents','update_incident'], 'Domain responder'),
  ('manager', 'Manager', ARRAY['view_incidents','view_audit_logs'], 'Management oversight')
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_sla_deadline ON incidents(sla_deadline);
CREATE INDEX IF NOT EXISTS idx_incidents_host ON incidents(host);
CREATE INDEX IF NOT EXISTS idx_audit_logs_incident ON audit_logs(incident_id);
CREATE INDEX IF NOT EXISTS idx_rules_active_priority ON assignment_rules(active, priority DESC);
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
