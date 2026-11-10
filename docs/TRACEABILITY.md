# HSCMS Requirements & Design Traceability Matrix

This document provides end-to-end traceability between the software engineering documentation (SRS, Use Case Model, Class Diagrams, SQA Test Cases) and the codebase implementation across **Increment 1**, **Increment 2**, and **Increment 3**.

> **Architecture & UML Mapping Note:**  
> The UML class diagram models distinct role entities (`HospitalAdministrator`, `InventoryManager`, `ProcurementOfficer`, `HospitalDepartmentStaff`, `SupplierVendor`). In accordance with Section 4 of `PROJECT_BRIEF.md`, this is implemented as a single, normalized `users` table containing a `role` discriminator column (`'Hospital Administrator'`, `'Inventory Manager'`, `'Procurement Officer'`, `'Hospital Department Staff'`, `'Supplier / Vendor'`). This preserves role polymorphism while avoiding multi-table joins for authentication and session verification.

---

## Increment 1 Traceability Table

| Screen / Feature | Route or API | SRS Section | Use Case | UML Class / Table | Test Case IDs |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication & Sign In** | `POST /api/auth/login`<br>`POST /api/auth/logout`<br>`GET /api/auth/me` | SRS 4.1.1 (User Authentication)<br>SRS 6.2.1 (Session Management) | Log In<br>Authenticate User | `users` | `TC-1.01`<br>`TC-1.02`<br>`TC-1.03` |
| **Role-Based Authorization & Security Gate** | `server/middleware/auth.js`<br>`authenticate`<br>`requireRole` | SRS 6.2.2 (Role-Based Access Control)<br>RMMM R3 (Privilege Escalation Prevention) | Enforce System Permissions | `users` | `TC-1.04`<br>`TC-1.05` |
| **User Account Management** | `GET /api/users`<br>`POST /api/users`<br>`PUT /api/users/:id`<br>`PATCH /api/users/:id/status` | SRS 4.1.2 (User Account Administration)<br>SRS 6.8.1 (Data Integrity) | Manage User Accounts<br>(Add, Update, Deactivate User) | `users`<br>`supplier` | `TC-1.06`<br>`TC-1.07` |
| **System Settings Management** | `GET /api/settings`<br>`PUT /api/settings` | SRS 4.1.3 (System Configuration & Policy)<br>SRS 5.1 (Policy Enforcement) | Manage System Settings | `system_setting` | `TC-1.13` |
| **Inventory Management** | `GET /api/supplies`<br>`POST /api/supplies`<br>`PUT /api/supplies/:id`<br>`DELETE /api/supplies/:id` | SRS 4.2.1 (Inventory Records & Batch Tracking)<br>SRS 5.1.1 (Unique Batch Enforcement) | Manage Inventory<br>(Add, Update, Delete Supply Details) | `medical_supply`<br>`inventory`<br>`supplier` | `TC-1.08`<br>`TC-1.09` |
| **Stock Level & Expiry Monitoring** | `GET /api/supplies`<br>`GET /api/supplies/:id`<br>`server/utils/stockUtils.js` | SRS 4.2.2 (Stock Level Monitoring)<br>SRS 4.2.3 (Expiry & Quarantine Control)<br>SRS 5.1 (Threshold Computation) | Monitor Stock Levels | `medical_supply`<br>`inventory` | `TC-1.10` |
| **Search & View Medical Supplies** | `GET /api/supplies`<br>`GET /api/supplies/categories`<br>`GET /api/supplies/:id` | SRS 4.4.1 (Supply Catalog Search) | Search Supplies<br>View Supply Details | `medical_supply` | `TC-1.14` |
| **Department Supply Requests** | `POST /api/requests`<br>`GET /api/requests/my` | SRS 4.4.2 (Clinical Requisitions)<br>SRS 5.1.1 (Quarantine on Expired Items) | Request Supplies | `supply_request`<br>`medical_supply`<br>`users` | `TC-1.11` |
| **Supply Request Review & Stock Deduction** | `GET /api/requests`<br>`POST /api/requests/:id/decide` | SRS 4.2.4 (Requisition Approval Workflow)<br>SRS 6.8.1 (Transactional Deduction) | Approve / Reject Department Supply Requests | `supply_request`<br>`medical_supply` | `TC-1.12` |
| **Role Dashboard Overview** | `GET /api/dashboard/stats` | SRS 4.1.4 (Role-Tailored KPI Dashboards) | View Dashboard Summary | `medical_supply`<br>`users`<br>`supply_request`<br>`inventory` | `TC-1.15` |

---

## Increment 2 Traceability Table

| Screen / Feature | Route or API | SRS Section | Use Case | UML Class / Table | Test Case IDs |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Manage Suppliers Directory** | `GET /api/suppliers`<br>`POST /api/suppliers`<br>`GET /api/suppliers/:id`<br>`PATCH /api/suppliers/:id/status` | SRS 4.3.1 (Supplier Management)<br>SRS 6.8.1 (Data Validation) | Manage Suppliers<br>(Add, View Details, Deactivate) | `supplier`<br>`purchase_order` | `TC-2.01`<br>`TC-2.02`<br>`TC-2.13` |
| **Create Purchase Order** | `POST /api/orders` | SRS 4.3.2 (Purchase Order Creation)<br>SRS 5.1.2 (Procurement Rules)<br>SRS 5.2.1 (Order Batching) | Create Purchase Order<br>(Select Supplier, Add Items) | `purchase_order`<br>`purchase_order_item`<br>`supplier`<br>`medical_supply` | `TC-2.02`<br>`TC-2.03`<br>`TC-2.04`<br>`TC-2.05` |
| **Track Purchase Orders & Delayed Detection** | `GET /api/orders`<br>`GET /api/orders/:id` | SRS 4.3.3 (Order Lifecycle Tracking)<br>SRS 4.3.4 (Delayed Delivery Identification)<br>SRS 5.2 (Fulfillment Tracking) | Track Purchase Order<br>(View Order Status, Timeline) | `purchase_order`<br>`purchase_order_item`<br>`supplier` | `TC-2.05`<br>`TC-2.09`<br>`TC-2.12` |
| **Order Cancellation** | `PATCH /api/orders/:id/cancel` | SRS 4.3.5 (Order Cancellation Protocol) | Cancel Purchase Order | `purchase_order` | `TC-2.06` |
| **Track Delivery & Stock Receipt** | `POST /api/orders/:id/receive` | SRS 4.3.6 (Delivery Inward & Stock Receipt)<br>SRS 6.8.1 (Atomic Database Transaction) | Mark Order as Received<br>Receive Stock | `purchase_order`<br>`purchase_order_item`<br>`medical_supply`<br>`inventory` | `TC-2.08`<br>`TC-2.10`<br>`TC-2.11` |
| **Supplier Portal: View Purchase Orders** | `GET /api/orders`<br>`GET /api/orders/:id` | SRS 4.5.1 (Vendor Order Access & Isolation)<br>RMMM R3 (Server-Side Isolation) | View Purchase Orders<br>(Own Orders Only) | `purchase_order`<br>`supplier`<br>`users` | `TC-2.08`<br>`TC-2.09` |
| **Supplier Portal: Dispatch & Delivery Info** | `PATCH /api/orders/:id/dispatch` | SRS 4.5.2 (Shipment Dispatch & Tracking) | Update Delivery Status<br>Enter Delivery Information | `purchase_order` | `TC-2.07` |
| **Procurement & Vendor Dashboards** | `GET /api/dashboard/stats` | SRS 4.1.4 (Role-Specific Metric Dashboards) | View Dashboard Summary | `purchase_order`<br>`supplier` | `TC-2.05`<br>`TC-2.12` |

---

## Increment 3 Traceability Table

| Screen / Feature | Route or API | SRS Section | Use Case | UML Class / Table | Test Case IDs |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Monitor Expiry Dates**<br>(Near Expiry & Expired Tabs) | `GET /api/supplies/expiry`<br>`server/utils/stockUtils.js` | SRS 4.2.3 (Expiry & Quarantine Control)<br>SRS 5.1.1 (Expiry Auto-Marking & Exclusion) | Monitor Expiry Dates | `medical_supply`<br>`system_setting` | `TC-3.01`<br>`TC-3.02`<br>`TC-3.14` |
| **Manage Disposal Records**<br>(Disposal Entry & History) | `POST /api/disposals`<br>`GET /api/disposals` | SRS 4.2.5 (Disposal Records & Quarantine Execution)<br>SRS 5.1.1 (Stock Depletion to DISPOSED) | Manage Disposal Records | `disposal_record`<br>`medical_supply`<br>`users` | `TC-3.03`<br>`TC-3.04`<br>`TC-3.05` |
| **Automated Alert Engine** | `server/services/alertEngine.js`<br>`POST /api/alerts/evaluate` | SRS 5.1 (Stock & Expiry Business Rules)<br>SRS 5.2 (Delivery Schedules)<br>SRS 5.2.1 (Delayed Delivery Rules) | Generate System Alerts<br>Evaluate Alert Conditions | `alert`<br>`medical_supply`<br>`purchase_order` | `TC-3.06`<br>`TC-3.07`<br>`TC-3.08`<br>`TC-3.09`<br>`TC-3.10`<br>`TC-3.14` |
| **Alerts Page & Top-Bar Bell Badge** | `GET /api/alerts`<br>`GET /api/alerts/count` | SRS 4.1.5 (Role-Tailored In-App Notifications)<br>SRS 6.2.2 (Role-Based Notification Visibility) | View Alerts<br>Navigate to Affected Records | `alert`<br>`users` | `TC-3.11` |
| **Full Dashboard & Category Chart** | `GET /api/dashboard/stats`<br>`public/vendor/chart.umd.min.js` | SRS 4.1.4 (Role KPI Dashboards)<br>SRS 5.1 (Stock Aggregation by Category) | View Dashboard Summary | `medical_supply`<br>`purchase_order`<br>`alert` | `TC-1.15`<br>`TC-3.11`<br>`TC-3.12` |
| **View Inventory Report** | `GET /api/reports/inventory` | SRS 4.1.6 (Inventory Audit & Stock Reports)<br>SRS 5.1 (Stock & Status Summary) | View Reports<br>(Inventory Report) | `medical_supply`<br>`supplier` | `TC-3.12`<br>`TC-3.13` |
| **View Procurement Report** | `GET /api/reports/procurement` | SRS 4.1.7 (Procurement Performance Reports)<br>SRS 5.2.1 (Order Metrics & Totals) | View Reports<br>(Procurement Report) | `purchase_order`<br>`purchase_order_item`<br>`supplier` | `TC-3.12`<br>`TC-3.13` |

---

## UML Use Case Diagram Mapping

Every use case defined in the Use Case Diagram (Section 3 of `PROJECT_BRIEF.md`) is mapped below to its primary actor, screen route, API route, test IDs, and implementation status:

| Actor | Use Case | Screen / Route | API Route | Test Case IDs | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **All Actors** | Log In | `/login.html` | `POST /api/auth/login` | `TC-1.01`, `TC-1.02`, `TC-1.03` | **Fully Implemented** |
| **Hospital Administrator** | Manage User Accounts | `/#users` | `GET /api/users`<br>`POST /api/users`<br>`PUT /api/users/:id`<br>`PATCH /api/users/:id/status` | `TC-1.06`, `TC-1.07` | **Fully Implemented** |
| **Hospital Administrator** | Manage System Settings | `/#settings` | `GET /api/settings`<br>`PUT /api/settings` | `TC-1.13` | **Fully Implemented** |
| **Hospital Administrator** | View Reports | `/#reports` | `GET /api/reports/inventory`<br>`GET /api/reports/procurement` | `TC-3.12`, `TC-3.13` | **Fully Implemented** |
| **Hospital Administrator** | View Dashboard Summary | `/#dashboard` | `GET /api/dashboard/stats` | `TC-1.15`, `TC-3.12` | **Fully Implemented** |
| **Inventory Manager** | Manage Inventory | `/#inventory` | `GET /api/supplies`<br>`POST /api/supplies`<br>`PUT /api/supplies/:id`<br>`DELETE /api/supplies/:id` | `TC-1.08`, `TC-1.09` | **Fully Implemented** |
| **Inventory Manager** | Monitor Stock Levels | `/#stock-monitoring` | `GET /api/supplies` | `TC-1.10`, `TC-3.06` | **Fully Implemented** |
| **Inventory Manager** | Monitor Expiry Dates | `/#expiry-monitoring` | `GET /api/supplies/expiry` | `TC-3.01`, `TC-3.02`, `TC-3.14` | **Fully Implemented** |
| **Inventory Manager** | Manage Disposal Records | `/#disposal-management` | `GET /api/disposals`<br>`POST /api/disposals` | `TC-3.03`, `TC-3.04`, `TC-3.05` | **Fully Implemented** |
| **Inventory Manager** | Approve / Reject Department Supply Requests | `/#manage-requests` | `GET /api/requests`<br>`POST /api/requests/:id/decide` | `TC-1.12` | **Fully Implemented** |
| **Procurement Officer** | Manage Suppliers | `/#manage-suppliers` | `GET /api/suppliers`<br>`POST /api/suppliers`<br>`GET /api/suppliers/:id`<br>`PATCH /api/suppliers/:id/status` | `TC-2.01`, `TC-2.02`, `TC-2.13` | **Fully Implemented** |
| **Procurement Officer** | Create Purchase Order | `/#purchase-orders` | `POST /api/orders` | `TC-2.02`, `TC-2.03`, `TC-2.04`, `TC-2.05` | **Fully Implemented** |
| **Procurement Officer** | Track Purchase Order | `/#purchase-orders` | `GET /api/orders`<br>`GET /api/orders/:id`<br>`PATCH /api/orders/:id/cancel` | `TC-2.05`, `TC-2.06`, `TC-2.12` | **Fully Implemented** |
| **Procurement Officer** | Mark Order as Received | `/#purchase-orders` | `POST /api/orders/:id/receive` | `TC-2.08`, `TC-2.10`, `TC-2.11` | **Fully Implemented** |
| **Hospital Department Staff** | Search Supplies | `/#browse-supplies` | `GET /api/supplies` | `TC-1.14` | **Fully Implemented** |
| **Hospital Department Staff** | View Supply Details | `/#browse-supplies` | `GET /api/supplies/:id` | `TC-1.14` | **Fully Implemented** |
| **Hospital Department Staff** | Request Supplies | `/#request-supplies` | `POST /api/requests`<br>`GET /api/requests/my` | `TC-1.11` | **Fully Implemented** |
| **Supplier / Vendor** | View Purchase Orders (Own Only) | `/#vendor-orders` | `GET /api/orders`<br>`GET /api/orders/:id` | `TC-2.08`, `TC-2.09` | **Fully Implemented** |
| **Supplier / Vendor** | View Order Details | `/#vendor-orders` | `GET /api/orders/:id` | `TC-2.08`, `TC-2.09` | **Fully Implemented** |
| **Supplier / Vendor** | Update Delivery Status | `/#vendor-deliveries` | `PATCH /api/orders/:id/dispatch` | `TC-2.07` | **Fully Implemented** |
| **Supplier / Vendor** | Enter Delivery Information | `/#vendor-deliveries` | `PATCH /api/orders/:id/dispatch` | `TC-2.07` | **Fully Implemented** |

---

## SRS Functional Requirements Coverage (Section 5)

| SRS Section | Description | Implementation Mechanism | Test Case IDs |
| :--- | :--- | :--- | :--- |
| **SRS 5.1** | Stock & Expiry Rules (Low stock when `quantity <= min_stock_level`, near-expiry within `near_expiry_days`) | `stockUtils.js`, `alertEngine.js`, `/api/supplies/expiry`, `/api/settings` | `TC-1.10`, `TC-1.13`, `TC-3.01`, `TC-3.06`, `TC-3.07` |
| **SRS 5.1.1** | Expired Item Quarantine & Disposal (Past expiry date auto-marked EXPIRED, cannot be requested/issued, disposed with quantity limits) | SQL auto-update in inventory/expiry/alert queries, `POST /api/requests` rejection, `POST /api/disposals` transaction | `TC-1.11`, `TC-3.02`, `TC-3.03`, `TC-3.04`, `TC-3.05`, `TC-3.14` |
| **SRS 5.2** | Procurement Lifecycle & Fulfillment (Expected date enforcement, state transitions: ORDERED &rarr; DISPATCHED &rarr; RECEIVED / CANCELLED) | `server/routes/orders.js`, order status checks, receipt stock addition | `TC-2.03`, `TC-2.05`, `TC-2.06`, `TC-2.07`, `TC-2.10` |
| **SRS 5.2.1** | Delayed Delivery Detection & Order Metrics (`expected_date < CURRENT_DATE` flags Delayed and generates alert) | Dynamic `is_delayed` computation, Alert Engine `DELAYED_DELIVERY` evaluation, Procurement Report | `TC-2.12`, `TC-3.08`, `TC-3.12` |

---

## Data Model (Class Diagram) Verification

| UML Class Name | Relational Table | Status | Key Constraints & Implementation |
| :--- | :--- | :--- | :--- |
| `users` | `users` | Fully Implemented & Tested | Unique on `email`, bcrypt hash, foreign key to `supplier`, `role` discriminator. |
| `inventory` | `inventory` | Fully Implemented | Represents Central Medical Store, Jeevan Jyoti General Hospital, Mumbai, default minimum stock level. Updated on stock receipt & disposals. |
| `MedicalSupply` | `medical_supply` | Fully Implemented & Tested | Composite UNIQUE on `(name, batch_no)`, status check (`AVAILABLE`, `EXPIRED`, `DISPOSED`). Incremented atomically upon PO receipt; decremented on requisition approval and disposal. |
| `supplier` | `supplier` | Fully Implemented & Tested | Validated email format, active status enforcement, order relation tracking. |
| `purchase_order` | `purchase_order` | Fully Implemented & Tested | Tracks status (`ORDERED`, `DISPATCHED`, `RECEIVED`, `CANCELLED`), `expected_date`, `dispatch_date`, `actual_date`, `notes`. |
| `purchase_order_item` | `purchase_order_item` | Fully Implemented & Tested | Cascade on order deletion, positive quantity check, no duplicate items per order. |
| `DisposalRecord` | `disposal_record` | Fully Implemented & Tested | Tracks `supply_id`, `quantity`, `disposal_date`, `reason`, `recorded_by`. Enforces quantity limits & sets status `DISPOSED` when quantity reaches 0. |
| `supply_request` | `supply_request` | Fully Implemented & Tested | Department supply requisitions with transactional deduction. Blocks expired supplies. |
| `alert` | `alert` | Fully Implemented & Tested | Four alert types (`LOW_STOCK`, `NEAR_EXPIRY`, `EXPIRED`, `DELAYED_DELIVERY`), deduplicated, auto-resolved, role-filtered. |
| `system_setting` | `system_setting` | Fully Implemented & Tested | Key-value store for `near_expiry_days` and `default_min_stock_level`. Triggers alert re-evaluation on update. |

---

## Partially Implemented Use Cases

**None.**  
Every use case specified in the Use Case Diagram and Section 3 of `PROJECT_BRIEF.md` is **fully implemented** on both client and server:
- All 5 user roles can log in and perform their exact specified use cases.
- Server-side role middleware strictly protects every route.
- Offline Chart.js rendering and CSV/print reporting function without external internet access.
