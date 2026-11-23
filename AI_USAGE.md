# AI Usage & Verification Log

In compliance with Section 4.1 (Rule R2) and Section 8 of the ENGN-F1 Assessment Brief, this log documents all AI assistance utilized during the 48-hour development window, including specific tasks and instances where human verification or override took place.

---

## 1. AI Tools Used
- **Google Antigravity Agent (Gemini 3.8 Flash)**
  - **Purpose:** Architecture scaffolding, boilerplate generation, validation rule translation, test runner setup, and documentation structure alignment.

---

## 2. Granular Task Log

| Phase / Component | AI Assistance Scope | Human Verification & Engineering Decision |
|---|---|---|
| **Project Setup & Architecture** | Scaffolding monorepo layout, drafting initial `README.md`, `SOLUTION.md`, and `.env.example`. | Verified exact folder naming (`frontend/`, `backend/`), monorepo structure, and ensure zero pre-written application code. |
| **API & Error Hierarchy** | Translating the 21 endpoints and strict error contract into Express routes and middleware. | Enforced strict error ordering: `401 -> 403 (role) -> 404 (path id) -> 403 (ownership) -> 400/422 (validation) -> 404 (referenced id) -> 409 (conflict)`. |
| **Concurrency Safeguards (B6)** | Designing PostgreSQL transaction logic for atomic resource slot overlap checking. | Overrode initial in-memory lock suggestion to enforce database-level row locking (`SELECT FOR UPDATE`) to guarantee process-safety under multi-instance/concurrent load. |
| **Deterministic Classifier (T-B1, T-B2)** | Writing regex and tokenization rules for auto-categorization. | Verified test cases for edge sentences like `"My package has not arrived"` to map strictly to `DELIVERY` and refund requests to `BILLING`. |

---

## 3. Human Verification & Override Instance

### Instance: Concurrency Lock Strategy for Slot Bookings (B6)
- **Initial AI Proposal:** The assistant initially suggested using an application-level mutex / in-memory lock library (`async-mutex`) inside Node.js to serialize booking requests.
- **Human Verification & Override:** Under production and multi-worker Node.js deployments (or clustered processes), an in-memory lock does not protect against concurrent requests hitting separate server instances or processes. I overrode this approach to mandate database-level atomicity using PostgreSQL transactions with `SELECT ... FOR UPDATE` row locks and exclusion range checks. This ensures that even across multiple parallel Node instances or simultaneous connection threads, the database guarantees that exactly 1 request returns `201` and the other 9 return `409`.
