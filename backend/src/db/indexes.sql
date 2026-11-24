-- TriageSync Trigram and Composite Optimization Indexes
-- Supports fast injection-safe search (T-B4) and latency optimization (Part C)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Composite B-Tree index for ticket queue filtering by status, category, and priority
CREATE INDEX IF NOT EXISTS idx_tickets_status_category_priority 
ON tickets (status, category, priority);

-- Trigram GIN index on combined subject and body text for high-speed ILIKE / regex search
CREATE INDEX IF NOT EXISTS idx_tickets_search_trgm 
ON tickets USING gin ((subject || ' ' || body) gin_trgm_ops);

-- Trigram GIN index on resource name and description
CREATE INDEX IF NOT EXISTS idx_resources_search_trgm 
ON resources USING gin (name gin_trgm_ops);
