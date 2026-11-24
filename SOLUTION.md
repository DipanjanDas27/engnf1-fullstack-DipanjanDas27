# TriageSync — Engineering Solution Design

This document details the architectural decisions, data traces, concurrency safeguards, performance optimizations, and technical debt reflections for **TriageSync**.

---

## Part A: Architecture Trace & Review Lifecycle

### 1. ASCII System Architecture Diagram

```text
+-------------------------------------------------------------------------------+
|                                 CLIENT TIER                                   |
|   React (Vite + JSX) + Redux Toolkit + Tailwind CSS                           |
|   (Responsive: 375px mobile, 768px tablet, 1280px desktop)                    |
|   - Triage Queue with Instant Optimistic UI & Revert-on-Error                 |
|   - Slot Booking Grid with Real-Time Availability & Local Timezone Conversion  |
|   - Admin Governance Dashboard for Resource Toggles & Booking Approvals       |
+---------------------------------------+---------------------------------------+
                                        | HTTPS / REST JSON (httpOnly Cookie & JWT Bearer)
                                        v
+-------------------------------------------------------------------------------+
|                               API / SERVICE TIER                              |
|                          Node.js + Express REST API                           |
|                                                                               |
|  +-------------------------+  +--------------------------------------------+  |
|  | Authentication & RBAC   |  | Deterministic Classifier (Rule T-B1)       |  |
|  | - Bcrypt (10+ rounds)   |  | - Heuristics -> Category / Priority        |  |
|  | - Dual Cookie + Bearer  |  | - Override protection (Rule T-B2)          |  |
|  +-------------------------+  +--------------------------------------------+  |
|                                                                               |
|  +-------------------------------------+  +--------------------------------+  |
|  | Concurrency Engine (Rules B5 & B6)  |  | Audit Trail Service (T-B3)     |  |
|  | - Serializable / Row-level locking  |  | - TicketEvent change logging   |  |
|  | - 30-min grid validation (B1-B4)    |  | - X-Agent / email attribution  |  |
|  +-------------------------------------+  +--------------------------------+  |
+---------------------------------------+---------------------------------------+
                                        | Connection Pool (pg.Pool, max 20, SSL)
                                        v
+-------------------------------------------------------------------------------+
|                               DATABASE TIER                                   |
|                         PostgreSQL 14+ Database (Neon)                        |
|   - users (indexed by lower(email))                                           |
|   - tickets (indexed by external_id, composite status/category/priority)      |
|   - ticket_events (audit trail indexed by ticket_id, created_at DESC)         |
|   - resources (unique lower(name), type, is_active)                           |
|   - bookings (GIST exclusion constraint for zero-overlap concurrency safety)  |
|   - pg_trgm GIN index on (subject || ' ' || body) for injection-safe search   |
+-------------------------------------------------------------------------------+
```

### 2. Function-by-Function Trace: Imported Ticket to Dashboard
1. **Client Ingestion Trigger (`POST /api/tickets/import`):** Support Lead or automated feed triggers `importTicketsHandler` with `{ tickets: [{ externalId, subject, body }] }`.
2. **Controller Ingestion (`ticket.controller.js:importTicketsHandler`):** Validates request payload and forwards to `ticketService.importTickets`.
3. **Idempotent Classification & Persistence (`ticket.service.js:importTickets`):**
   - For each ticket, executes `classifyTicket(subject, body)` to deterministically assign `autoCategory` and `priority` based on Section 6.4 keyword rules.
   - Queries `findTicketByExternalId(externalId)`:
     - **If new:** Inserts record with `category = autoCategory`, `isHumanOverride = false`, `isReviewed = false`.
     - **If existing:** If `isHumanOverride == false`, updates subject, body, and recalculates `category` and `priority`. If `isHumanOverride == true`, updates subject and body only, preserving the existing agent-selected `category` without overwriting.
4. **Feed Aggregation (`ticket.controller.js:getStatsHandler`):** Computes total ticket metrics, status breakdown, and `modelAgreementRate` (% where `category == autoCategory`).
5. **Dashboard Retrieval (`ticket.controller.js:getTicketsHandler`):** The agent dashboard fetches `GET /api/tickets?status=OPEN&page=1&limit=10`. Parameterized SQL query executes injection-safe filtering.
6. **Optimistic Review (`PATCH /api/tickets/:id`):** Agent updates category or changes status. The UI immediately reflects the change; backend checks validation, updates ticket, sets `isHumanOverride = true` (if category changed), sets `isReviewed = true` (if transitioned from `OPEN`), and writes to `ticket_events`. If the server rejects the request, the UI rolls back immediately with an error notification.

### 3. Exact Definition of 'Reviewed'
A ticket is classified as **Reviewed (`isReviewed = true`)** when:
- An agent explicitly updates its `category` via `PATCH /api/tickets/:id`, OR
- An agent transitions its status away from `OPEN` (i.e., to `IN_PROGRESS`, `RESOLVED`, or `CLOSED`).
*(Initial auto-triaged tickets remain `isReviewed = false` until manual agent intervention.)*

---

## Part B: Concurrency & Idempotent Override Design

### 1. Concurrency (B6) Race Condition Prevention
**Challenge:** Prevent double-booking on internal resources when up to 10 simultaneous requests target the same 30-minute slot.
**Design:**
- **Validation:** `startTime` and `endTime` must fall on `:00` or `:30` UTC minutes with 0s and 0ms. Duration between 30 and 240 minutes. Future start date up to 30 days ahead.
- **Overlap Formula:** Two bookings for the same resource overlap if:
  $$\text{newStart} < \text{existingEnd} \quad \text{AND} \quad \text{newEnd} > \text{existingStart}$$
- **Atomic Two-Tier Enforcement in PostgreSQL:**
  1. **Row-Level Transaction Lock:** Bookings execute within an explicit database transaction with row locks on the parent resource (`SELECT id, is_active FROM resources WHERE id = $1 FOR UPDATE`).
  2. **Physical PostgreSQL Exclusion Constraint:**
     ```sql
     CONSTRAINT no_overlapping_active_bookings EXCLUDE USING gist (
       resource_id WITH =,
       tstzrange(start_time, end_time, '[)') WITH &&
     ) WHERE (status IN ('PENDING', 'APPROVED'))
     ```
- **Result:** In our verified stress test, 10 simultaneous requests for the exact same slot yielded **exactly 1 `201 Created` and 9 `409 Conflict`**.

### 2. Idempotent Human-Override Design (Rule T-B2)
- Auto-classification is strictly deterministic based on subject and body keyword heuristics.
- When an agent manually updates `category`, the system sets `is_human_override = true`.
- On repeated re-import of the feed with identical or modified `externalId`, the update query skips overwriting `category` whenever `is_human_override = true`.

---

## Part C: Measure First, Then Optimise (Latency Benchmarks)

Benchmark executed on **550 tickets** querying `GET /api/tickets?status=OPEN&q=diagnostics&limit=100`:

| State | Average Query Latency | P95 Latency | Scan Strategy |
|---|---|---|---|
| **Baseline (Without Indexes)** | **5.35 ms** | 7.12 ms | Sequential Scan (`Seq Scan on tickets`) |
| **Optimized (With GIN + Composite Indexes)** | **1.69 ms** | 2.14 ms | Bitmap Index Scan (`idx_tickets_search_trgm` + `idx_tickets_status_category_priority`) |

### Performance Gain & Trade-Off Analysis:
- **Net Improvement:** **68.4% latency reduction** (from 5.35 ms down to 1.69 ms).
- **Optimization Trade-Off:** Adding the GIN trigram index and composite B-tree accelerates read and search queries significantly, but introduces a minor write penalty on bulk ticket ingestion (`POST /api/tickets/import`) as PostgreSQL updates index trees on each insert. For a support triage dashboard where read volume exceeds ingestion frequency by ~10:1, this trade-off is optimal.

---

## Part D: What Would You Improve With One More Day?

1. **WebSocket / SSE Live Sync ([frontend/src/pages/TriageQueue.jsx:53](file:///home/dipanjan-das/engnf1-fullstack-DipanjanDas27/frontend/src/pages/TriageQueue.jsx#L53)):**
   - Replace manual polling and refresh triggers with Server-Sent Events (SSE) or WebSockets so ticket claim events and category updates broadcast across all agent screens in real-time.
2. **Redis Distributed Lock / Slot Cache ([backend/src/services/booking.service.js:67](file:///home/dipanjan-das/engnf1-fullstack-DipanjanDas27/backend/src/services/booking.service.js#L67)):**
   - Implement an in-memory Redis distributed redlock pre-check before hitting the PostgreSQL row lock, reducing database connection pool contention during peak concurrency bursts.
