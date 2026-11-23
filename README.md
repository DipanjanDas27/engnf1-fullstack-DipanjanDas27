# TriageSync

TriageSync is a full-stack support triage and resource-slot scheduling web application built for the **ENGN-F1 Hackathon & Placement Assessment**. It streamlines incoming ticket ingestion with deterministic auto-triage and human-override preservation, provides agent audit trails and optimistic UI reviews, and coordinates 30-minute race-safe resource slot bookings under concurrent load.

---

## 1. Overview
Support teams receive hundreds of incoming tickets daily. TriageSync:
- Automatically classifies and prioritizes ticket feeds idempotently while strictly protecting human overrides.
- Equips support agents with real-time optimistic review interfaces, dynamic filtering, safe substring query searches, and full audit histories (`ticket_events`).
- Manages 30-minute internal resource slot bookings (rooms, labs, diagnostic equipment) with guaranteed atomic concurrency protection.

---

## 2. Live Links
- **Frontend Live URL:** *(To be updated upon deployment)*
- **Backend API Live URL:** *(To be updated upon deployment)*
- **GitHub Repository:** [https://github.com/DipanjanDas27/engnf1-fullstack-DipanjanDas27](https://github.com/DipanjanDas27/engnf1-fullstack-DipanjanDas27)

---

## 3. Seeded Credentials

| Role | Name | Email | Password | Access Level |
|---|---|---|---|---|
| **ADMIN** | Admin Lead | `admin@triagesync.test` | `Admin@123` | Resource management, booking approvals/rejections, analytics dashboard |
| **USER** | Agent Demo | `user@triagesync.test` | `User@123` | Ticket triage review, personal bookings, active resource search |

---

## 4. Tech Stack
- **Frontend:** React (JavaScript / JSX), Vite, Tailwind CSS, Lucide Icons
- **Backend:** Node.js, Express.js (JavaScript, REST API)
- **Database:** PostgreSQL (with transaction locking for atomic race-safety)
- **Authentication:** JWT (24-hour expiry) & Bcrypt (cost 10+)
- **Testing & Tools:** Node test runner / Supertest / Autocannon for concurrency testing

---

## 5. Folder Structure
```text
engnf1-fullstack-DipanjanDas27/
├── backend/                  # Express REST API (JavaScript)
│   ├── src/
│   │   ├── config/           # Database pool, environment config
│   │   ├── controllers/      # Route controllers (auth, tickets, resources, bookings)
│   │   ├── middleware/       # Auth (JWT), role guard, error handler, validation
│   │   ├── models/           # Database query abstractions & schemas
│   │   ├── routes/           # REST endpoint routers (/api/*)
│   │   ├── services/         # Classifier, booking concurrency logic
│   │   └── index.js          # Express app entry point
│   ├── scripts/              # Idempotent database migrations and seed script
│   └── package.json
├── frontend/                 # React application (Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/       # UI components, layout, filter bars, modals
│   │   ├── context/          # Auth context, notification context
│   │   ├── hooks/            # Optimistic UI & API hooks
│   │   ├── pages/            # Login, Triage, Resources, My Bookings, Admin
│   │   ├── services/         # API client
│   │   └── App.jsx
│   └── package.json
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore specification
├── AI_USAGE.md               # AI tooling transparency & verification log
├── SOLUTION.md               # Architecture trace, concurrency design, benchmarks
└── README.md                 # Project documentation
```

---

## 6. Local Setup & Idempotent Seed Command

### Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+) or Docker

### Setup Instructions
1. **Clone the repository:**
   ```bash
   git clone https://github.com/DipanjanDas27/engnf1-fullstack-DipanjanDas27.git
   cd engnf1-fullstack-DipanjanDas27
   ```

2. **Backend Configuration:**
   ```bash
   cd backend
   cp ../.env.example .env
   npm install
   # Run migrations and idempotent seed script:
   npm run db:setup
   npm run dev
   ```

3. **Frontend Configuration:**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

4. **Idempotent Seed Command:**
   ```bash
   cd backend
   npm run seed
   ```
   *Note: Running `npm run seed` multiple times is safe and never creates duplicate tickets, users, or resources.*

---

## 7. DB Schema

The database runs on PostgreSQL with the following core entities:
- **`users`**: `id`, `name`, `email` (unique, lowercase), `password_hash`, `role` (`USER` | `ADMIN`), `created_at`.
- **`tickets`**: `id`, `external_id` (unique), `subject`, `body`, `auto_category`, `category`, `is_human_override` (boolean), `priority`, `status`, `assignee_id`, `is_reviewed` (boolean), `created_at`, `updated_at`.
- **`ticket_events`**: `id`, `ticket_id`, `field`, `old_value`, `new_value`, `actor`, `created_at`.
- **`resources`**: `id`, `name` (unique, case-insensitive), `type` (`ROOM` | `LAB` | `EQUIPMENT`), `capacity`, `description`, `is_active`, `created_at`.
- **`bookings`**: `id`, `resource_id`, `user_id`, `ticket_id`, `start_time`, `end_time`, `purpose`, `status` (`PENDING` | `APPROVED` | `REJECTED` | `CANCELLED`), `decision_note`, `created_at`.

---

## 8. API Summary
Base path: `/api`. Responses adhere strictly to `{ data: [], page, pageSize, total, totalPages }` and `{ error: { code, message } }`.

| Method | Endpoint | Access | Summary |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register standard user |
| POST | `/api/auth/login` | Public | Authenticate user & issue JWT |
| GET | `/api/auth/me` | Logged in | Get current profile |
| POST | `/api/tickets/import` | Logged in | Idempotent bulk import with auto-triage |
| GET | `/api/tickets` | Logged in | Filtered paginated tickets with safe search |
| GET | `/api/tickets/:id` | Logged in | Ticket detail with event audit trail |
| PATCH | `/api/tickets/:id` | Logged in | Update ticket, record override & audit |
| GET | `/api/stats` | Logged in | Category/priority stats & model agreement % |
| GET | `/api/resources` | Logged in | List resources (active only for users) |
| GET | `/api/resources/:id` | Logged in | Resource details |
| POST | `/api/resources` | ADMIN | Create new resource |
| PATCH | `/api/resources/:id` | ADMIN | Update resource properties |
| GET | `/api/resources/:id/availability` | Logged in | Availability timeline for date range |
| POST | `/api/bookings` | Logged in | Book slot (atomic race-safe) |
| GET | `/api/bookings/mine` | Logged in | User's bookings |
| GET | `/api/bookings/:id` | Owner/ADMIN | Booking details |
| GET | `/api/bookings` | ADMIN | All bookings with filters |
| PATCH | `/api/bookings/:id/cancel` | Owner | Cancel pending/approved booking |
| PATCH | `/api/bookings/:id/approve` | ADMIN | Approve pending booking |
| PATCH | `/api/bookings/:id/reject` | ADMIN | Reject pending booking with note |
| GET | `/api/admin/stats` | ADMIN | Admin operational metrics |

---

## 9. Completed Features Checklist
- [x] Initial monorepo layout and documentation scaffolding
- [ ] PostgreSQL schema with constraints & indexes
- [ ] Idempotent seed script with mandatory test accounts & seed data
- [ ] Auth & RBAC endpoints with bcrypt (cost 10+) and JWT
- [ ] Deterministic auto-triage classifier & human-override protection
- [ ] Ticket review, injection-safe search, and audit logging (`ticket_events`)
- [ ] Race-safe resource booking with atomic concurrency protection
- [ ] Frontend with responsive design and instant Optimistic UI rollback
- [ ] Concurrency verification script (10 simultaneous requests test)
- [ ] Live deployment on HTTPS

---

## 10. Known Limitations
- Resource slot bookings are restricted to 30-minute grid increments (`:00` or `:30` UTC).
- In accordance with hackathon rules, registrations create `USER` accounts only; `ADMIN` accounts are seeded.
