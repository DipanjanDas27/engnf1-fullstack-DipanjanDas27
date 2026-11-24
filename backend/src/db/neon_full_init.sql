-- ============================================================================
-- TriageSync — Complete Neon Database Initialization & Seed Script
-- Pure SQL: Can be pasted directly into Neon Console -> SQL Editor and Run
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 50),
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(10) NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

-- 3. TICKETS TABLE
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id VARCHAR(255) NOT NULL UNIQUE,
  subject VARCHAR(150) NOT NULL CHECK (char_length(trim(subject)) BETWEEN 3 AND 150),
  body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 5 AND 2000),
  auto_category VARCHAR(30) NOT NULL CHECK (auto_category IN ('BILLING', 'BUG', 'FEATURE_REQUEST', 'LOGIN', 'DELIVERY')),
  category VARCHAR(30) NOT NULL CHECK (category IN ('BILLING', 'BUG', 'FEATURE_REQUEST', 'LOGIN', 'DELIVERY')),
  is_human_override BOOLEAN NOT NULL DEFAULT FALSE,
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets (category);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets (priority);
CREATE INDEX IF NOT EXISTS idx_tickets_status_category_priority ON tickets (status, category, priority);
CREATE INDEX IF NOT EXISTS idx_tickets_search_trgm ON tickets USING gin ((subject || ' ' || body) gin_trgm_ops);

-- 4. TICKET EVENTS (Audit Trail for T-B3)
CREATE TABLE IF NOT EXISTS ticket_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  field VARCHAR(20) NOT NULL CHECK (field IN ('category', 'priority', 'status', 'assigneeId')),
  old_value TEXT,
  new_value TEXT,
  actor VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket_id ON ticket_events (ticket_id, created_at DESC);

-- 5. RESOURCES TABLE
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('ROOM', 'LAB', 'EQUIPMENT')),
  capacity INTEGER NOT NULL CHECK (capacity >= 1 AND capacity <= 500),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 1000),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_resources_name_lower ON resources (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources (type);
CREATE INDEX IF NOT EXISTS idx_resources_is_active ON resources (is_active);
CREATE INDEX IF NOT EXISTS idx_resources_search_trgm ON resources USING gin (name gin_trgm_ops);

-- 6. BOOKINGS TABLE (Atomic exclusion for concurrency safety Rule B6)
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  purpose VARCHAR(200) NOT NULL CHECK (char_length(trim(purpose)) BETWEEN 5 AND 200),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  decision_note TEXT CHECK (decision_note IS NULL OR char_length(decision_note) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_booking_chronology CHECK (end_time > start_time),
  CONSTRAINT no_overlapping_active_bookings EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (status IN ('PENDING', 'APPROVED'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_resource_id ON bookings (resource_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_time_range ON bookings (start_time, end_time);

-- ============================================================================
-- 7. SEED DATA (Idempotent: Uses ON CONFLICT to prevent duplicates)
-- ============================================================================

-- Mandatory Users (Admin & User with bcrypt hash cost 10)
INSERT INTO users (id, name, email, password_hash, role)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'Admin Lead', 'admin@triagesync.test', '$2a$10$vHyEtGuRtoDGnbQQ/yKhhuPsRkOQ5TT7OhYnFLtQmzrRBPlpBVm6a', 'ADMIN'),
  ('a0000000-0000-0000-0000-000000000002', 'Agent Demo', 'user@triagesync.test', '$2a$10$ez21ZRDI0JdES7msbGyMtuLSoN17nahaAdhd3sdx8PWcYuAjVUkra', 'USER')
ON CONFLICT (LOWER(email)) DO UPDATE
SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash;

-- Mandatory Resources (>=6 resources: >=2 ROOM, >=2 LAB, >=2 EQUIPMENT, >=1 inactive)
INSERT INTO resources (name, type, capacity, description, is_active)
VALUES
  ('Conference Room Apollo', 'ROOM', 20, 'Primary conference room with AV equipment', true),
  ('Meeting Suite Gemini', 'ROOM', 10, 'Executive meeting and interview space', true),
  ('Electronics Debug Lab', 'LAB', 8, 'Hardware diagnostics and testing lab', true),
  ('Cleanroom Testing Chamber', 'LAB', 4, 'Isolated cleanroom environment (currently undergoing calibration)', false),
  ('Spectrum Analyzer Rig', 'EQUIPMENT', 2, 'RF waveform and signal analyzer', true),
  ('Precision 3D Scanner', 'EQUIPMENT', 1, 'Sub-millimeter optical component inspection scanner', true)
ON CONFLICT (LOWER(name)) DO UPDATE
SET type = EXCLUDED.type, capacity = EXCLUDED.capacity, description = EXCLUDED.description, is_active = EXCLUDED.is_active;

-- Mandatory Support Tickets (All categories, priorities, >=1 XSS tag, >=3 isReviewed=true)
INSERT INTO tickets (external_id, subject, body, auto_category, category, is_human_override, priority, status, is_reviewed)
VALUES
  ('EXT-1001', 'Overcharge on corporate invoice', 'We noticed an unexpected charge on our latest monthly invoice. Requesting a full refund for the duplicate payment.', 'BILLING', 'BILLING', false, 'HIGH', 'OPEN', false),
  ('EXT-1002', 'Annual subscription payment receipt request', 'Please provide the tax invoice and VAT breakdown for our latest annual renewal payment.', 'BILLING', 'BILLING', false, 'MEDIUM', 'OPEN', false),
  ('EXT-1003', 'Credit card refund confirmation required', 'Agent verified the duplicate transaction and processed credit refund.', 'BILLING', 'BILLING', true, 'HIGH', 'IN_PROGRESS', true),
  ('EXT-2001', 'Locked out of engineer portal', 'Production down and lead developer locked out after 2fa failure. Need urgent reset immediately.', 'LOGIN', 'LOGIN', false, 'URGENT', 'OPEN', false),
  ('EXT-2002', 'Reset single sign on credentials', 'Employee forgotten password for the SSO portal. Requesting a sign in verification link.', 'LOGIN', 'LOGIN', false, 'MEDIUM', 'OPEN', false),
  ('EXT-2003', 'Security team cleared 2fa reset', 'Agent assisted user with hardware key reset and identity verification.', 'LOGIN', 'LOGIN', true, 'MEDIUM', 'RESOLVED', true),
  ('EXT-3001', 'My package has not arrived', 'Tracking indicates delivered yesterday morning but package has not arrived at loading dock.', 'DELIVERY', 'DELIVERY', false, 'HIGH', 'OPEN', false),
  ('EXT-3002', 'Replacement diagnostic probe delivery status', 'Expedited shipping tracking number is showing no updates for 48 hours.', 'DELIVERY', 'DELIVERY', false, 'MEDIUM', 'OPEN', false),
  ('EXT-4001', 'Critical production 500 error on checkout', 'System crash throwing unhandled 500 exception when customers submit order. Urgent production down situation.', 'BUG', 'BUG', false, 'URGENT', 'OPEN', false),
  ('EXT-4002', 'Dashboard broken table formatting', 'Column headers misaligned on Firefox browser after latest release.', 'BUG', 'BUG', false, 'LOW', 'OPEN', false),
  ('EXT-4003', 'Hotfix deployed for memory leak', 'Agent verified the bug fix patch on staging server and moved status to resolved.', 'BUG', 'BUG', false, 'HIGH', 'RESOLVED', true),
  ('EXT-5001', 'Dark mode theme toggle support', 'Would love to have an automated dark mode theme option based on OS system preferences.', 'FEATURE_REQUEST', 'FEATURE_REQUEST', false, 'LOW', 'OPEN', false),
  ('EXT-5002', 'Bulk export tickets to CSV', 'Managers need a feature to export monthly triage reports to spreadsheet format.', 'FEATURE_REQUEST', 'FEATURE_REQUEST', false, 'MEDIUM', 'OPEN', false),
  ('EXT-5003', 'Webhook notifications on ticket triage', 'Ability to register outbound webhooks when category or priority changes.', 'FEATURE_REQUEST', 'FEATURE_REQUEST', false, 'MEDIUM', 'OPEN', false),
  ('EXT-5004', 'Customizable ticket queue sort filters', 'Support engineers would like to save custom sorting preferences in browser localStorage.', 'FEATURE_REQUEST', 'FEATURE_REQUEST', false, 'LOW', 'CLOSED', true),
  ('EXT-6001', 'Security check: <script>alert("xss-test")</script>', 'Verifying XSS-safe text escaping: <script>document.cookie="stolen"</script> and <img src=x onerror=alert(1)> must render as sanitized plain text.', 'BUG', 'BUG', false, 'HIGH', 'OPEN', false)
ON CONFLICT (external_id) DO UPDATE
SET subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    auto_category = EXCLUDED.auto_category,
    category = CASE WHEN tickets.is_human_override THEN tickets.category ELSE EXCLUDED.category END,
    priority = EXCLUDED.priority,
    status = EXCLUDED.status,
    is_reviewed = EXCLUDED.is_reviewed;
