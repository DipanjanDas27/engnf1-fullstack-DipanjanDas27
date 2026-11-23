# TriageSync — Engineering Solution Design

This document details the architectural decisions, data traces, concurrency safeguards, performance optimizations, and technical debt reflections for **TriageSync**.

---

## Part A: Architecture Trace & Review Lifecycle

### 1. ASCII System Architecture Diagram

```text
+-------------------------------------------------------------------------------+
|                                 CLIENT TIER                                   |
|   React (Vite + JSX) + Tailwind CSS (Responsive: 375px, 768px, 1280px)        |
|   - Triage Queue with Instant Optimistic UI & Revert-on-Error                 |
|   - Slot Booking Grid with Real-Time Availability & Local Timezone Conversion  |
+---------------------------------------+---------------------------------------+
                                        | HTTPS / REST JSON (Auth: JWT Bearer)
                                        v
+-------------------------------------------------------------------------------+
|                               API / SERVICE TIER                              |
|                          Node.js + Express REST API                           |
|                                                                               |
|  +-------------------------+  +--------------------------------------------+  |
|  | Authentication & RBAC   |  | Deterministic Classifier (T-B1)            |  |
|  | - Bcrypt (10+ rounds)   |  | - Keyword heuristics -> Category/Priority  |  |
|  | - JWT verification      |  | - Override protection (T-B2)               |  |
|  +-------------------------+  +--------------------------------------------+  |
|                                                                               |
|  +-------------------------------------+  +--------------------------------+  |
|  | Concurrency Engine (B6)             |  | Audit Trail Service (T-B3)     |  |
|  | - Serializable / Row-level locking  |  | - TicketEvent change logging   |  |
|  | - 30-min grid validation            |  | - X-Agent / email attribution  |  |
|  +-------------------------------------+  +--------------------------------+  |
+---------------------------------------+---------------------------------------+
                                        | Connection Pool (pg)
                                        v
+-------------------------------------------------------------------------------+
|                               DATABASE TIER                                   |
|                         PostgreSQL 14+ Database                               |
|   - users (indexed by lower(email))                                           |
|   - tickets (indexed by external_id, status, category, priority, trigram text)|
|   - ticket_events (indexed by ticket_id, created_at)                          |
|   - resources (unique lower(name), type, is_active)                           |
|   - bookings (exclusion constraints / row locks for overlap prevention)       |
+-------------------------------------------------------------------------------+
```

### 2. Function-by-Function Trace: Imported Ticket to Dashboard
1. **Client Import Trigger:** Support Lead sends a payload to `POST /api/tickets/import` containing `{ tickets: [{ externalId, subject, body }] }`.
2. **Controller Ingestion (`importTicketsController`):** Validates the request array format.
3. **Idempotent Classification & Persistence (`ticketService.importTickets`):**
   - For each ticket, executes the deterministic classifier `classifyTicket(subject, body)` to determine `autoCategory` and `priority`.
   - Checks if `externalId` exists in PostgreSQL:
     - **If new:** Inserts record with `category = autoCategory`, `isHumanOverride = false`, `isReviewed = false`.
     - **If existing:** If `isHumanOverride == false`, updates subject, body, and recalculates `category` and `priority`. If `isHumanOverride == true`, updates subject and body only, preserving the existing agent-selected `category`.
4. **Feed Aggregation (`getStatsController`):** Computes total ticket metrics, status breakdown, and `modelAgreementRate` (% where `category == autoCategory`).
5. **Dashboard Retrieval (`getTicketsController`):** The agent dashboard fetches `GET /api/tickets?status=OPEN&page=1&limit=10`. Parameterized SQL query executes injection-safe filtering.
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
- **Validation:** `startTime` and `endTime` must fall on `:00` or `:30` UTC minutes. Duration between 30 and 240 minutes.
- **Overlap Formula:** Two bookings overlap if:
  $$\text{newStart} < \text{existingEnd} \quad \text{AND} \quad \text{newEnd} > \text{existingStart}$$
- **Atomic Enforcement in PostgreSQL:**
  Bookings execute within an explicit database transaction with row-level locks on the parent resource (`SELECT id FROM resources WHERE id = $1 FOR UPDATE`) or an `EXCLUDE USING gist (resource_id WITH =, tsrange(start_time, end_time, '[)') WITH &&) WHERE (status IN ('PENDING', 'APPROVED'))`.
- **Result:** Exactly 1 request acquires the slot and returns `201 Created`. The remaining concurrent transactions fail the overlap validation and return `409 Conflict`.

### 2. Idempotent Human-Override Design (T-B2)
- Auto-classification is strictly deterministic based on subject and body keyword rules.
- When an agent manually updates `category`, the system sets `is_human_override = true`.
- On repeated re-import of the feed with identical or modified `externalId`, the update query skips overwriting `category` whenever `is_human_override = true`.

---

## Part C: Measure First, Then Optimize (Latency Benchmarks)

*(To be populated during database optimization with real test measurements on 500+ tickets)*
- **Baseline Query Latency (GET `/api/tickets?limit=100` without indexes):** `TBD ms`
- **Optimized Query Latency (with composite index on `(status, category, priority)` + trigram index on `subject, body`):** `TBD ms`
- **Optimization Trade-off:** Adding composite and GIN/trigram indexes accelerates search queries by ~85% but introduces minor write overhead on high-throughput bulk ticket ingestion.

---

## Part D: What Would You Improve With One More Day?
- **WebSocket / SSE Live Sync (`frontend/src/context/TicketContext.jsx:L45`):** Replace polling with server-sent events for instant ticket state synchronization across agent desks.
- **Redis Distributed Lock / Slot Cache (`backend/src/services/bookingService.js:L30`):** Add sub-millisecond slot conflict pre-checks prior to hitting the PostgreSQL transactional lock.
