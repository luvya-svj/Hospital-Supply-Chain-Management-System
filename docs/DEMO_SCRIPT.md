# HSCMS Faculty Demonstration Script
## Hospital Supply Chain Management System (HSCMS)

**Target Duration:** ~10 minutes  
**Narrative Arc:** Traces the complete lifecycle of medical supplies across all five system roles — from procurement and vendor dispatch, to store receipt, clinical requisition, expiry quarantine, and final disposal.

---

### Demo Accounts Quick Reference

| Role | Email | Password | Primary Mission |
| :--- | :--- | :--- | :--- |
| **Procurement Officer** | `procurement@hscms.test` | `Procure@123` | Create & track purchase orders, receive incoming shipments |
| **Supplier / Vendor** | `supplier@hscms.test` | `Supplier@123` | View own POs, dispatch shipments with tracking details |
| **Hospital Department Staff** | `staff@hscms.test` | `Staff@123` | Search medical catalog, submit clinical ward requisitions |
| **Inventory Manager** | `inventory@hscms.test` | `Inventory@123` | Approve requisitions, monitor expiry tabs, execute disposals |
| **Hospital Administrator** | `admin@hscms.test` | `Admin@123` | Review dashboard & Chart.js, configure settings, export reports |

> **Note on Demo Mode:** When `DEMO_MODE=true` in `.env`, the login screen displays a convenient **Demo accounts** chip bar that automatically pre-fills credentials for any role with a single click.

---

### Act 1: Procurement Officer — Ordering Stock (Minutes 0:00 – 2:00)

1. **Sign In**: Navigate to `http://localhost:3000` (or `login.html`). Click the **Procurement Officer** chip and sign in.
2. **Dashboard Overview**:
   - Point out the role-tailored KPI cards: **Open Orders**, **Delayed Orders**, **Received This Month**, and **Total Orders**.
   - Notice the **Alert Bell** in the top bar showing an active badge for delayed delivery alerts.
3. **Manage Purchase Orders (`#purchase-orders`)**:
   - Show the existing purchase orders in the data table.
   - Point out Order **#4** with the amber **Delayed** badge (expected date was 3 days ago and not yet received).
4. **Create a Purchase Order**:
   - Click **Create Purchase Order**.
   - Select Supplier: **Sahyadri Pharma Distributors**.
   - Expected Delivery Date: Select a date 7 days in the future (note that past dates are rejected by form validation).
   - Add Item: Select **Paracetamol 500mg Tablets**, Quantity: **100**.
   - Click **Add Another Item**: Select **Amoxicillin 500mg Capsules**, Quantity: **50**.
   - Enter Notes: *"Routine quarterly replenishment for oral medications."*
   - Click **Create Purchase Order**. A success toast confirms creation with status **ORDERED**.
5. **Sign Out**: Click the **Logout** button in the top bar. Confirm the sign-out dialog.

---

### Act 2: Supplier / Vendor — Dispatching the Shipment (Minutes 2:00 – 3:30)

1. **Sign In**: Click the **Supplier / Vendor** demo chip (`supplier@hscms.test`).
2. **Server-Enforced Supplier Isolation**:
   - Note that this vendor (Amit Shah) sees **only orders placed with Sahyadri Pharma Distributors**; Bharat MediSupply orders are completely inaccessible.
   - Notice that the Alert Bell is hidden for vendors (in-app alerts are restricted to hospital operational roles).
3. **View Purchase Orders (`#vendor-orders`)**:
   - Open the newly created Purchase Order from Act 1 (status: **ORDERED**).
   - Review the order item list and quantities.
4. **Dispatch Order (`#vendor-orders` / `#vendor-deliveries`)**:
   - Click **Dispatch Shipment** on the newly created purchase order (Order #5).
   - Enter Dispatch Date (today) and Logistics Tracking Note: *"Dispatched via MedExpress Logistics, Tracking #MX-990142. In transit."*
   - Click **Confirm Dispatch**.
   - The visual order timeline immediately updates to show the **DISPATCHED** state with the green checkpoint.
5. **Sign Out**: Log out of the Supplier account.

---

### Act 3: Procurement Officer — Receiving & Stocking Inventory (Minutes 3:30 – 5:00)

1. **Sign In**: Log back in as **Procurement Officer** (`procurement@hscms.test`).
2. **Order Status Verification**:
   - Navigate to **Purchase Orders (`#purchase-orders`)**.
   - Show that the order now displays the amber **Dispatched** status badge.
3. **Receive Stock Transaction**:
   - Goods have physically arrived at the hospital central loading dock.
   - Click **Receive Stock** on the dispatched order.
   - Note the **Confirmation Dialog** explaining that receiving the order will stamp the actual arrival date and **atomically increment medical supply stock in the database**.
   - Click **Receive Stock**.
   - Success toast appears: Order is now marked **RECEIVED**, and hospital inventory counts are updated.
4. **Sign Out**: Log out of the Procurement account.

---

### Act 4: Department Staff — Clinical Ward Requisition (Minutes 5:00 – 6:30)

1. **Sign In**: Log in as **Hospital Department Staff** (`staff@hscms.test` — Nurse Sneha Patil, Emergency (Casualty) Department).
2. **Search Catalog (`#browse-supplies`)**:
   - Search for *"Paracetamol"*.
   - View the available quantity (which now includes the 100 units stocked in Act 3).
   - Try searching for an expired supply (e.g., *"Aspirin"*): Notice the red **Expired** badge and notice that expired items are blocked from clinical request.
3. **Submit Requisition (`#request-supplies`)**:
   - Select Supply: **Paracetamol 500mg Tablets**.
   - Department: Automatically pre-filled as **Emergency (Casualty)**.
   - Quantity: Enter **10** boxes.
   - Click **Submit Requisition**.
4. **Verify Request Status (`#my-requests`)**:
   - The requisition appears at the top of the history list with status **PENDING**.
5. **Sign Out**: Log out of the Staff account.

---

### Act 5: Inventory Manager — Approvals, Expiry Quarantine & Disposal (Minutes 6:30 – 8:30)

1. **Sign In**: Log in as **Inventory Manager** (`inventory@hscms.test` — Rajesh Kulkarni).
2. **Approve Requisition (`#manage-requests`)**:
   - View Nurse Sneha Patil's pending request for 10 units of Paracetamol.
   - Click **Approve**. Confirm dialog prompts for approval.
   - On confirmation, available stock is transactionally decremented from the database.
3. **Monitor Expiry Dates (`#expiry-monitoring`)**:
   - Click **Monitor Expiry Dates** in the sidebar.
   - **Tab 1: Near Expiry**:
     - Shows supplies expiring within `near_expiry_days` (30 days by default), such as *Human Albumin* (14 days remaining), *Povidone Iodine* (8 days remaining).
     - Point out the **Days Remaining** column colour-coded in amber/red.
   - **Tab 2: Expired**:
     - Shows supplies past their expiry date (*Aspirin 75mg*, *VTM Swabs*).
     - Point out the **Days Overdue** column and the auto-assigned **EXPIRED** status badge.
4. **Execute Disposal (`#disposal-management`)**:
   - Click the red **Dispose** button next to an expired supply (or click **Record Disposal** on `#disposal-management`).
   - Select **Aspirin 75mg Gastro-Resistant** (Batch `ASP-2025-X9`).
   - Enter Quantity to Dispose (e.g., 60 units to fully dispose, or partial quantity).
   - Attempt to enter a quantity greater than stock: show that validation prevents exceeding available inventory.
   - Enter Reason: *"Routine quarantine disposal of expired pharmaceuticals per hospital policy."*
   - Click **Confirm Disposal**. A confirmation dialog verifies the irreversible stock deduction.
   - Upon disposal:
     - A new record is added to the **Disposal History** table with timestamp and manager name.
     - When quantity reaches 0, the supply status transitions to **DISPOSED**.
     - The corresponding EXPIRED alert in the Alert Engine resolves automatically.
5. **Disposal History Table**:
   - Show the searchable table with date filters (`From Date` / `To Date`).
6. **Sign Out**: Log out of the Inventory Manager account.

---

### Act 6: Hospital Administrator — Dashboard, Alerts, Settings & Reports (Minutes 8:30 – 10:00)

1. **Sign In**: Log in as **Hospital Administrator** (`admin@hscms.test` — Dr. Ananya Deshpande).
2. **Full Dashboard (`#dashboard`)**:
   - Point out the **Top-Bar Alert Bell** showing the count of unresolved alerts. Click it to navigate to `#alerts`.
   - On the Dashboard:
     - Review all 6 KPI cards (**Total System Accounts**, **Active Users**, **Main Store Info**, **Open Orders**, **Delayed Orders**).
     - **Stock Distribution by Category**: Point out the interactive horizontal/vertical bar chart rendered using **offline local Chart.js** (`public/vendor/chart.umd.min.js`), requiring no internet.
     - **Urgent Alerts Widget**: Displays top priority alerts with direct click-through navigation.
3. **System Settings & Dynamic Thresholds (`#settings`)**:
   - Show **Near Expiry Threshold (Days)**: currently `30`.
   - Update it to `45` and save.
   - Explain that changing this setting immediately updates calculations across Expiry Monitoring, Alert Engine, and Reports without server restart.
4. **View Reports (`#reports`)**:
   - **Inventory Report Tab**:
     - Filter by Category or Status.
     - Review summary KPI cards (**Total Items**, **Total Quantity**, **Low Stock**, **Near Expiry**, **Expired**).
     - Click **Export CSV**: Open/show the downloaded `inventory_report.csv`.
     - Click **Print Report**: Point out the clean print view preview (`@media print`) that strips navigation sidebars and headers for paper audit.
   - **Procurement Report Tab**:
     - Filter by Supplier and Date Range.
     - Review order totals (**Total Orders**, **Total Items Qty**, **Ordered**, **Dispatched**, **Received**, **Delayed**).
     - Click **Export CSV** to download `procurement_report.csv`.
5. **Conclusion**:
   - Summarize the full loop: Order &rarr; Dispatch &rarr; Receive &rarr; Requisition &rarr; Expiry Monitoring &rarr; Disposal &rarr; Reports.
   - All 38 automated test cases passing; 100% requirements and use case traceability.
