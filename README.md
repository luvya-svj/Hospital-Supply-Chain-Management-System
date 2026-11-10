# Hospital Supply Chain Management System (HSCMS)

Demonstration web application for the college Software Engineering curriculum, strictly mapped to the project SRS, UML diagrams, SQA plan, and RMMM documentation across all three increments:
- **Increment 1:** Login, Role-Based Access Control, User Management, System Settings, Inventory Management, Stock Monitoring, Department Requests.
- **Increment 2:** Supplier Management, Purchase Orders, Delayed Delivery Detection, Receiving & Stock Addition, Vendor Portal with Isolation.
- **Increment 3:** Expiry Monitoring (Near Expiry & Expired Tabs), Disposal Records & Quarantine, Automated Alert Engine, Top-Bar Alert Bell, Full Dashboard with offline Chart.js, Inventory & Procurement Reports (CSV Export & Clean Print View), Final Polish.

---

## Tech Stack
- **Backend:** Node.js + Express.js (REST API, JSON)
- **Database:** PostgreSQL (Connection string via `.env`)
- **Frontend:** Plain HTML, CSS, JavaScript (zero build tools, vanilla design system)
- **Authentication:** Email + password, bcrypt password hashing, `httpOnly` session cookies
- **Visualization:** Chart.js bundled locally (`public/vendor/chart.umd.min.js`) for completely offline operation
- **Testing:** Jest + Supertest (automated test IDs `TC-1.01` through `TC-3.13`, 38 tests total)
- **Documentation:** `docs/TRACEABILITY.md` (Traceability matrix) and `docs/DEMO_SCRIPT.md` (10-minute faculty demo walkthrough)

---

## Directory Structure
```
├── .env                       # Local PostgreSQL connection & config
├── .env.example               # Reference template for environment variables
├── package.json               # Project scripts & dependencies
├── server/
│   ├── app.js                 # Express application & session configuration
│   ├── server.js              # Server entry point & alert scheduler
│   ├── config/
│   │   └── db.js              # PostgreSQL client connection pool
│   ├── middleware/
│   │   ├── auth.js            # Authentication & role-based access control
│   │   └── errorHandler.js    # Clean error handling without stack traces
│   ├── routes/
│   │   ├── auth.js            # Authentication endpoints (login, logout, me)
│   │   ├── users.js           # Admin user management
│   │   ├── settings.js        # Admin system threshold configuration
│   │   ├── inventory.js       # Inventory management, stock & expiry monitoring
│   │   ├── requests.js        # Department supply requests & manager approvals
│   │   ├── dashboard.js       # Role-specific KPI metrics & category chart data
│   │   ├── suppliers.js       # Supplier directory & management
│   │   ├── orders.js          # Purchase orders & delivery fulfillment
│   │   ├── alerts.js          # Role-filtered alert notifications & unread counts
│   │   ├── disposal.js        # Disposal records & stock depletion
│   │   └── reports.js         # Inventory & Procurement reports with CSV/Print
│   ├── services/
│   │   └── alertEngine.js     # Background alert engine (Startup, hourly, hooks)
│   ├── db/
│   │   ├── schema.sql         # Full DDL for all 10 UML tables
│   │   ├── init.js            # Schema execution script (npm run db:init)
│   │   └── seed.js            # Realistic clinical seed data (npm run db:seed)
│   └── utils/
│       └── stockUtils.js      # Business rules for stock and expiry calculations
├── public/
│   ├── css/
│   │   ├── tokens.css         # Clinical modern design tokens (Section 6)
│   │   ├── layout.css         # Split login, responsive sidebar, top bar
│   │   └── components.css     # Tables, badges, modals, toasts, empty states, print
│   ├── js/
│   │   ├── api.js             # API fetch wrapper
│   │   ├── components.js      # Reusable table engine, modals, alerts, badges
│   │   ├── auth.js            # Login view controller & demo quick-fill
│   │   └── app.js             # View router, role-tailored dashboards, reports
│   ├── vendor/
│   │   └── chart.umd.min.js   # Offline Chart.js library
│   ├── login.html             # Multi-role authentication view
│   └── index.html             # Authenticated system shell with alert bell
├── tests/
│   ├── increment1.test.js     # Increment 1 automated tests (TC-1.01 to TC-1.12)
│   ├── increment2.test.js     # Increment 2 automated tests (TC-2.01 to TC-2.13)
│   └── increment3.test.js     # Increment 3 automated tests (TC-3.01 to TC-3.13)
└── docs/
    ├── TRACEABILITY.md        # Software engineering traceability matrix
    └── DEMO_SCRIPT.md         # 10-minute faculty demonstration script
```

---

## Setup & Running from a Clean Machine

### 1. Prerequisites
- Node.js (v18 or higher recommended)
- PostgreSQL (v14 or higher running locally on port 5432)

### 2. Configure Database Connection
Copy `.env.example` to `.env` (or configure your existing `.env`):
```env
PORT=3000
DATABASE_URL=postgres://postgres:<YOUR_PASSWORD>@localhost:5432/hscms
SESSION_SECRET=hscms_super_secret_session_key_2026
DEMO_MODE=true
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Initialize Database Tables
Creates all 10 tables defined in the project brief:
```bash
npm run db:init
```

### 5. Populate Demo Dataset
Populates realistic hospital stores, suppliers, 5 role demo accounts, 27 medical supplies with low-stock, near-expiry and expired edge cases, department requests, and purchase orders:
```bash
npm run db:seed
```

### 6. Run Automated Test Suite
Executes the Jest test suite across all 3 increments (38 tests):
```bash
npm test
```

### 7. Start the Web Server
```bash
npm start
```
Open your browser and navigate to: **[http://localhost:3000](http://localhost:3000)**

---

## Demo Accounts (1-Click Fill in Login Page)

When `DEMO_MODE=true`, you can click any of the role chips on the login page to immediately fill the credentials:

| Role | Email | Password | Full System Capabilities |
| :--- | :--- | :--- | :--- |
| **Hospital Administrator** | `admin@hscms.test` | `Admin@123` | Full dashboard with stock chart, all alerts, user management, system thresholds, and Inventory / Procurement reports (CSV & Print). |
| **Inventory Manager** | `inventory@hscms.test` | `Inventory@123` | Stock catalog CRUD, stock level monitoring, expiry monitoring (Near Expiry & Expired tabs), disposal records, department request approval, stock/expiry alerts. |
| **Procurement Officer** | `procurement@hscms.test` | `Procure@123` | Supplier directory management, purchase order creation with multiple items, order tracking, order cancellation, stock receiving, delayed delivery alerts. |
| **Hospital Department Staff** | `staff@hscms.test` | `Staff@123` | Search supplies, view details, submit clinical ward requisitions, track personal request history. Expired and zero-stock items barred from request. |
| **Supplier / Vendor** | `supplier@hscms.test` | `Supplier@123` | Vendor portal with strict server-enforced isolation (Sahyadri Pharma sees only Sahyadri orders), view purchase orders, dispatch shipments with carrier and tracking info. |

---

## Faculty Walkthrough & Traceability

- **Demonstration Walkthrough:** Refer to [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) for a structured 10-minute demonstration tracing one supply from ordering to disposal.
- **Traceability Matrix:** Refer to [`docs/TRACEABILITY.md`](docs/TRACEABILITY.md) for full mapping between SRS sections (4.1 through 5.2.1), UML Use Cases, UML Classes, Database Tables, Screen Routes, and Automated Test IDs (`TC-1.01` to `TC-3.13`).
