# PROJECT BRIEF — Hospital Supply Chain Management System (HSCMS)

This file is the single source of truth for the build. Read it fully before doing any work. It summarises the project's SRS, UML (use case and class diagrams), Gantt/PERT, SQA plan and RMMM plan. This is a college Software Engineering project that will be demonstrated to a faculty member, so **the finished app must visibly map to those documents**: use the same names for roles, modules, classes, use cases and alerts. Do not add features that are not listed here. Do not remove features that are.

## 1. Purpose
A web-based system that lets hospital staff manage medical supply inventory, suppliers and purchase orders, delivery tracking, expiry monitoring and disposal records, with in-app alerts and reports.

## 2. Tech stack (SRS section 3.3)
- Backend: Node.js + Express.js (REST API, JSON)
- Database: PostgreSQL (connection string in `.env` as `DATABASE_URL`). If PostgreSQL is unavailable, STOP and ask the user before switching databases.
- Frontend: plain HTML, CSS and JavaScript (no framework, no build step), served by Express from `/public`
- Auth: email + password, passwords hashed with bcrypt, session in an httpOnly cookie
- Charts: Chart.js installed via npm and served locally (the demo must work without internet)
- Tests: Jest + Supertest
- Folder layout: `/server` (routes, middleware, services, db/schema.sql, db/seed.js), `/public` (css, js, pages), `/tests`, `/docs`

## 3. Roles (one login page; the account's role decides everything)
Use these exact role names. They come from the use case diagram.

| Role | Can do (use cases) |
|---|---|
| Hospital Administrator | Log in; Manage User Accounts (add/update user, deactivate user); Manage System Settings; View Reports (Inventory Report, Procurement Report); dashboard |
| Inventory Manager | Manage Inventory (add / update / delete supply details); Monitor Stock Levels; Monitor Expiry Dates; Manage Disposal Records; approve or reject department supply requests |
| Procurement Officer | Manage Suppliers (add / view supplier details); Create Purchase Order (select supplier, add items); Track Purchase Order (view order status, track delivery); mark an order as received |
| Hospital Department Staff | Search Supplies; View Supply Details; Request Supplies (select department, specify quantity) |
| Supplier / Vendor | View Purchase Orders (own orders only); View Order Details; Update Delivery Status; Enter Delivery Information |

Permissions MUST be enforced on the server (middleware on every route), not just by hiding menu items (SRS 6.2.2, RMMM R3).

## 4. Data model (class diagram → tables)
Use snake_case table names that clearly match the UML class names.

- `users` — user_id, name, email (unique), password_hash, role, department (staff only), supplier_id (supplier users only), contact, is_active, created_at. *(The UML has one class per role: adminId, managerId, officerId, staffId. Implement as one `users` table with a role column and note this in the traceability doc.)*
- `inventory` — inventory_id, name, min_stock_level (default minimum for new supplies), last_updated. One row: "Main Hospital Store".
- `medical_supply` (MedicalSupply) — supply_id, inventory_id, name, category, batch_no, quantity, unit, min_stock_level, expiry_date, supplier_id (nullable), status (AVAILABLE / EXPIRED / DISPOSED), updated_at. Unique on (name, batch_no).
- `supplier` — supplier_id, name, contact, email, address, is_active.
- `purchase_order` — order_id, supplier_id, created_by, order_date, status (ORDERED / DISPATCHED / RECEIVED / CANCELLED), expected_date, actual_date, notes.
- `purchase_order_item` — id, order_id, supply_id, quantity. *(Not drawn in the class diagram but required by the "Add Items" use case.)*
- `disposal_record` (DisposalRecord) — disposal_id, supply_id, quantity, disposal_date, reason, recorded_by.
- `supply_request` — request_id, supply_id, requested_by, department, quantity, status (PENDING / APPROVED / REJECTED), request_date, decided_by, decided_at. *(Required by the "Request Supplies" use case.)*
- `alert` — alert_id, type (LOW_STOCK / NEAR_EXPIRY / EXPIRED / DELAYED_DELIVERY), supply_id (nullable), order_id (nullable), message, created_at, is_resolved.
- `system_setting` — key, value. Seed: `near_expiry_days = 30`, `default_min_stock_level = 20`.

## 5. Business rules
- Low stock: `quantity <= min_stock_level` and status is AVAILABLE.
- Near expiry: expiry_date is within `near_expiry_days` days from today and not yet past.
- Expired: expiry_date is before today. Expired supplies are marked EXPIRED, are NOT counted as available stock, and CANNOT be requested or issued (SRS 5.1.1, 6.8.1).
- Delayed delivery: purchase order `expected_date` is before today and status is not RECEIVED or CANCELLED.
- Marking a purchase order RECEIVED sets `actual_date` and adds each item's quantity to its medical supply, and updates `inventory.last_updated`.
- Approving a supply request deducts the quantity from stock (reject if insufficient or expired).
- Disposing of a supply records a `disposal_record` (item, batch, quantity, date, reason) and reduces its quantity; when quantity reaches 0 status becomes DISPOSED.
- Validate all input on the server: quantities are positive integers, expiry dates are valid, emails are valid, required fields present, duplicate (name, batch_no) rejected (SQA data accuracy guidelines, RMMM R1 and R10).
- Use parameterised SQL queries only. Never build SQL by string concatenation.

## 6. UI / UX standards (professional, visually appealing, practical)
- Visual tone: calm, clean, clinical-modern. Not flashy, not a template look.
- Define design tokens once in `public/css/tokens.css`: background `#F5F7FA`, surface `#FFFFFF`, border `#E5E7EB`, text `#1F2937`, muted text `#6B7280`, primary `#0F766E` (teal), primary hover `#115E59`, danger `#DC2626`, warning `#D97706`, success `#16A34A`, info `#2563EB`. Radius 8px. Subtle shadows only.
- Font: Inter with a system-font fallback stack (no layout shift if it fails to load).
- Layout: fixed left sidebar (menu depends on role, active item highlighted), top bar with page title, alert bell with count badge (from Increment 3), and a user chip with name, role and logout. Content area on a light background with cards.
- Components to build once and reuse: stat cards, data tables (sticky header, hover row, search box, filter dropdowns, sortable columns, pagination above 10 rows), status badges (colour AND text, never colour alone), modal forms, confirm dialogs for delete/deactivate, toast notifications, empty states, loading states, inline form validation messages.
- Colour meaning is consistent everywhere: red = expired / critical, amber = low stock / near expiry / delayed, green = OK / received, blue = informational.
- Login page: split layout; left panel with the system name and a short tagline, right panel with the form. No role dropdown. When `DEMO_MODE=true`, show a small "Demo accounts" helper that fills in credentials.
- Responsive down to tablet width; sidebar collapses to a menu button on narrow screens.
- Accessibility: visible focus states, labelled inputs, sufficient contrast, keyboard-usable dialogs.
- Use inline SVG icons. No emoji in the UI. No lorem ipsum anywhere; use realistic hospital data.

## 7. Increments (follow the Gantt/PERT order; do only the increment you are asked to do)
1. **Increment 1** — Login and User Management, Stock Monitoring: project setup, design system, database, authentication, role-based navigation, user accounts, system settings, inventory management, search/view/request supplies, stock level monitoring, basic dashboard.
2. **Increment 2** — Supplier Management, Procurement Management, Delivery Tracking.
3. **Increment 3** — Expiry Management, Disposal Management, Alerts and Reports, final polish.

## 8. Quality rules (from the SQA plan and RMMM)
- Write automated tests for stock calculations, expiry checks, alert conditions, role permissions and key API routes. Give test cases IDs like `TC-1.01`.
- Handle errors gracefully with clear messages; never show stack traces to users.
- Log failed login attempts.
- Keep code modular, with meaningful names and comments only where the logic is not obvious.

## 9. Traceability (required)
Maintain `docs/TRACEABILITY.md`, updated at the end of every increment, as a table with these columns: Screen / Feature | Route or API | SRS section | Use case | UML class / table | Test case IDs. Faculty will use this to check the app against the documents.

## 10. Out of scope (do not build)
Shortage prediction or machine learning, billing or payments, insurance integration, patient records, email or SMS notifications (alerts are in-app only), external integrations of any kind.
