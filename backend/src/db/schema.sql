-- TriageSync Relational Database Schema
-- Strict adherence to ENGN-F1 Full Stack Candidate Brief (Version 2.0) Section 6.2 & 6.3

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 50),
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(10) NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique case-insensitive index on user email
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

-- 2. Tickets Table
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

-- 3. Ticket Events (Audit Trail for T-B3)
CREATE TABLE IF NOT EXISTS ticket_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  field VARCHAR(20) NOT NULL CHECK (field IN ('category', 'priority', 'status', 'assigneeId')),
  old_value TEXT,
  new_value TEXT,
  actor VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket_id ON ticket_events (ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_events_created_at ON ticket_events (created_at DESC);

-- 4. Resources Table
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(60) NOT NULL CHECK (char_length(trim(name)) BETWEEN 3 AND 60),
  type VARCHAR(20) NOT NULL CHECK (type IN ('ROOM', 'LAB', 'EQUIPMENT')),
  capacity INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 500),
  description VARCHAR(300),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique case-insensitive index on resource name
CREATE UNIQUE INDEX IF NOT EXISTS idx_resources_name_lower ON resources (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_resources_is_active ON resources (is_active);

-- 5. Bookings Table (Resource Slot Booking with Concurrency Race-Safety)
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  purpose VARCHAR(200) NOT NULL CHECK (char_length(trim(purpose)) BETWEEN 5 AND 200),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  decision_note VARCHAR(200) CHECK (decision_note IS NULL OR char_length(trim(decision_note)) BETWEEN 5 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_end_time_after_start_time CHECK (end_time > start_time),
  -- B5 & B6: Physical PostgreSQL-level exclusion constraint preventing overlapping slots
  CONSTRAINT no_overlapping_active_bookings EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (status IN ('PENDING', 'APPROVED'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_resource_id ON bookings (resource_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings (start_time);
