const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

// Helper to format date YYYY-MM-DD
function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function seed() {
  console.log('Seeding database with realistic demo data...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Clear existing data (in dependency order)
    await client.query('DELETE FROM alert');
    await client.query('DELETE FROM supply_request');
    await client.query('DELETE FROM disposal_record');
    await client.query('DELETE FROM purchase_order_item');
    await client.query('DELETE FROM purchase_order');
    await client.query('DELETE FROM medical_supply');
    await client.query('DELETE FROM users');
    await client.query('DELETE FROM supplier');
    await client.query('DELETE FROM inventory');
    await client.query('DELETE FROM system_setting');

    // 1. System Settings
    console.log('Seeding system settings...');
    await client.query(`
      INSERT INTO system_setting (key, value) VALUES
      ('near_expiry_days', '30'),
      ('default_min_stock_level', '20')
    `);

    // 2. Inventory (Central Medical Store, Jeevan Jyoti General Hospital, Mumbai)
    console.log('Seeding inventory store...');
    const invRes = await client.query(`
      INSERT INTO inventory (name, min_stock_level, last_updated)
      VALUES ('Central Medical Store, Jeevan Jyoti General Hospital, Mumbai', 20, CURRENT_TIMESTAMP)
      RETURNING inventory_id
    `);
    const inventoryId = invRes.rows[0].inventory_id;

    // 3. Suppliers
    console.log('Seeding suppliers...');
    const supRes = await client.query(`
      INSERT INTO supplier (name, contact, email, address, is_active) VALUES
      ('Sahyadri Pharma Distributors', '+91-20-5550-0199', 'orders@sahyadripharma.test', 'Plot 42, MIDC Bhosari, Pune, Maharashtra 411026', true),
      ('Bharat MediSupply Pvt. Ltd.', '+91-22-5550-0245', 'sales@bharatmedisupply.test', 'Unit 12, Andheri Industrial Estate, Andheri West, Mumbai, Maharashtra 400053', true),
      ('Konkan Surgicals and Equipment', '+91-22-5550-0371', 'info@konkansurgicals.test', '88 Wagle Industrial Estate, Thane West, Maharashtra 400604', true),
      ('Lifeline Diagnostics Traders', '+91-22-5550-0482', 'support@lifelinediagnostics.test', 'Sector 19, Vashi, Navi Mumbai, Maharashtra 400703', true),
      ('Deccan Biomedical Supplies', '+91-253-5550-0593', 'contact@deccanbio.test', 'Plot 15, Ambad MIDC, Nashik, Maharashtra 422010', true),
      ('Western Ghats Healthcare Traders', '+91-20-5550-0618', 'sales@westernghatshc.test', 'Gat No. 108, Hinjewadi Phase 2, Pune, Maharashtra 411057', true)
      RETURNING supplier_id, name
    `);
    const suppliers = supRes.rows;

    // 4. Demo Users (5 roles specified in Section 3 & Setup instructions)
    console.log('Seeding demo users...');
    const saltRounds = 10;
    const adminHash = await bcrypt.hash('Admin@123', saltRounds);
    const invManagerHash = await bcrypt.hash('Inventory@123', saltRounds);
    const procureHash = await bcrypt.hash('Procure@123', saltRounds);
    const staffHash = await bcrypt.hash('Staff@123', saltRounds);
    const supplierHash = await bcrypt.hash('Supplier@123', saltRounds);

    const userRes = await client.query(`
      INSERT INTO users (name, email, password_hash, role, department, supplier_id, contact, is_active) VALUES
      ('Dr. Ananya Deshpande', 'admin@hscms.test', $1, 'Hospital Administrator', 'Administration', NULL, '+91-98200-11001', true),
      ('Rajesh Kulkarni', 'inventory@hscms.test', $2, 'Inventory Manager', 'Logistics & Store', NULL, '+91-98200-11002', true),
      ('Priya Nair', 'procurement@hscms.test', $3, 'Procurement Officer', 'Procurement', NULL, '+91-98200-11003', true),
      ('Nurse Sneha Patil', 'staff@hscms.test', $4, 'Hospital Department Staff', 'Emergency (Casualty)', NULL, '+91-98200-11004', true),
      ('Sahyadri Pharma Distributors', 'supplier@hscms.test', $5, 'Supplier / Vendor', NULL, $6, '+91-98200-11005', true)
      RETURNING user_id, email, role
    `, [adminHash, invManagerHash, procureHash, staffHash, supplierHash, suppliers[0].supplier_id]);

    const staffUser = userRes.rows.find(u => u.role === 'Hospital Department Staff');
    const procureUser = userRes.rows.find(u => u.role === 'Procurement Officer');
    const invUser = userRes.rows.find(u => u.role === 'Inventory Manager');

    // 5. Medical Supplies (~35 items with required categories, units, and edge cases)
    console.log('Seeding medical supplies...');
    const suppliesData = [
      // Normal Stock & Healthy Expiry (Medicines)
      { name: 'Paracetamol 500mg Tablets', category: 'Medicines', batch: 'PCM-2026-A1', qty: 250, unit: 'Box of 100', min: 40, expDays: 365, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Amoxicillin 500mg Capsules', category: 'Medicines', batch: 'AMX-2026-B2', qty: 180, unit: 'Box of 50', min: 30, expDays: 300, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Ceftriaxone 1g Injection', category: 'Medicines', batch: 'CTX-2026-C1', qty: 95, unit: 'Vial', min: 25, expDays: 450, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Ibuprofen 400mg Tablets', category: 'Medicines', batch: 'IBU-2026-D4', qty: 140, unit: 'Box of 100', min: 30, expDays: 280, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Normal Saline 0.9% 500ml', category: 'Medicines', batch: 'NS-2026-09', qty: 320, unit: 'IV Bottle', min: 50, expDays: 500, supIdx: 1, status: 'AVAILABLE' },
      { name: 'Ringer Lactate 500ml', category: 'Medicines', batch: 'RL-2026-05', qty: 260, unit: 'IV Bottle', min: 50, expDays: 520, supIdx: 1, status: 'AVAILABLE' },
      { name: 'Oral Rehydration Salts (ORS) Sachets 20.5g', category: 'Medicines', batch: 'ORS-2026-O1', qty: 350, unit: 'Box of 50', min: 50, expDays: 540, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Pantoprazole 40mg Tablets', category: 'Medicines', batch: 'PAN-2026-P4', qty: 220, unit: 'Box of 100', min: 30, expDays: 450, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Metformin 500mg Tablets', category: 'Medicines', batch: 'MET-2026-M5', qty: 300, unit: 'Box of 100', min: 40, expDays: 400, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Azithromycin 500mg Tablets', category: 'Medicines', batch: 'AZI-2026-A5', qty: 160, unit: 'Box of 30', min: 25, expDays: 365, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Ondansetron 4mg Injection', category: 'Medicines', batch: 'OND-2026-O4', qty: 140, unit: 'Ampoule', min: 30, expDays: 420, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Cetirizine 10mg Tablets', category: 'Medicines', batch: 'CET-2026-C1', qty: 200, unit: 'Box of 100', min: 30, expDays: 480, supIdx: 0, status: 'AVAILABLE' },

      // Normal Stock & Healthy Expiry (Surgical)
      { name: 'Surgical Scalpel #10', category: 'Surgical', batch: 'SCP-2026-10', qty: 120, unit: 'Box of 20', min: 20, expDays: 730, supIdx: 2, status: 'AVAILABLE' },
      { name: 'Sterile Gauze Swabs 10x10cm', category: 'Surgical', batch: 'GZ-2026-G1', qty: 200, unit: 'Pack of 50', min: 30, expDays: 600, supIdx: 1, status: 'AVAILABLE' },
      { name: 'Silk Sutures 3-0 with Needle', category: 'Surgical', batch: 'SUT-2026-30', qty: 85, unit: 'Box of 24', min: 15, expDays: 540, supIdx: 2, status: 'AVAILABLE' },
      { name: 'Disposable Umbilical Cord Clamps', category: 'Surgical', batch: 'UCC-2026-55', qty: 90, unit: 'Box of 100', min: 20, expDays: 700, supIdx: 2, status: 'AVAILABLE' },

      // Normal Stock & Healthy Expiry (PPE)
      { name: 'N95 Respirator Masks', category: 'PPE', batch: 'N95-2026-V1', qty: 450, unit: 'Box of 20', min: 60, expDays: 720, supIdx: 1, status: 'AVAILABLE' },
      { name: 'Disposable Surgical Gowns (L)', category: 'PPE', batch: 'GWN-2026-L', qty: 130, unit: 'Piece', min: 30, expDays: 900, supIdx: 1, status: 'AVAILABLE' },
      { name: 'Protective Face Shields', category: 'PPE', batch: 'FSD-2026-01', qty: 160, unit: 'Piece', min: 25, expDays: 1000, supIdx: 1, status: 'AVAILABLE' },

      // Normal Stock & Healthy Expiry (Diagnostics)
      { name: 'Blood Glucose Test Strips', category: 'Diagnostics', batch: 'GLU-2026-TS', qty: 110, unit: 'Pack of 50', min: 25, expDays: 240, supIdx: 3, status: 'AVAILABLE' },
      { name: 'Glucometer Test Strips Pack', category: 'Diagnostics', batch: 'GLU-2026-G5', qty: 180, unit: 'Pack of 50', min: 30, expDays: 360, supIdx: 3, status: 'AVAILABLE' },
      { name: 'Rapid Dengue Ag/Ab Test Kit', category: 'Diagnostics', batch: 'DEN-2026-DK', qty: 75, unit: 'Kit of 25', min: 15, expDays: 360, supIdx: 3, status: 'AVAILABLE' },
      { name: 'Urine Test Strips 10 Parameter', category: 'Diagnostics', batch: 'URN-2026-10', qty: 90, unit: 'Vial of 100', min: 20, expDays: 270, supIdx: 3, status: 'AVAILABLE' },

      // Normal Stock & Healthy Expiry (Consumables)
      { name: 'Disposable Syringes 5ml with Needle', category: 'Consumables', batch: 'SYR-2026-05', qty: 500, unit: 'Box of 100', min: 50, expDays: 600, supIdx: 1, status: 'AVAILABLE' },
      { name: 'IV Cannula 20G Pink', category: 'Consumables', batch: 'CAN-2026-20', qty: 220, unit: 'Box of 50', min: 40, expDays: 650, supIdx: 1, status: 'AVAILABLE' },
      { name: 'Alcohol Prep Pads 70% IPA', category: 'Consumables', batch: 'APP-2026-IPA', qty: 380, unit: 'Box of 200', min: 40, expDays: 480, supIdx: 1, status: 'AVAILABLE' },

      // EDGE CASES: At least 3 Low Stock Items (quantity <= min_stock_level, status AVAILABLE)
      { name: 'Adrenaline (Epinephrine) 1mg/ml', category: 'Medicines', batch: 'ADR-2026-E1', qty: 8, unit: 'Ampoule', min: 30, expDays: 180, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Nitrile Examination Gloves (Medium)', category: 'PPE', batch: 'GLV-2026-NM', qty: 12, unit: 'Box of 100', min: 50, expDays: 400, supIdx: 1, status: 'AVAILABLE' },
      { name: 'Endotracheal Tube 7.5mm Cuffed', category: 'Surgical', batch: 'ETT-2026-75', qty: 5, unit: 'Piece', min: 20, expDays: 365, supIdx: 2, status: 'AVAILABLE' },
      { name: 'Disposable Syringes 10ml', category: 'Consumables', batch: 'SYR-2026-10', qty: 15, unit: 'Box of 50', min: 30, expDays: 450, supIdx: 1, status: 'AVAILABLE' },

      // EDGE CASES: At least 3 Near Expiry Items (within 30 days, not yet past)
      { name: 'Human Albumin 20% 50ml Infusion', category: 'Medicines', batch: 'ALB-2026-20', qty: 35, unit: 'Bottle', min: 15, expDays: 14, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Troponin-I Rapid Diagnostic Cards', category: 'Diagnostics', batch: 'TROP-2026-09', qty: 40, unit: 'Box of 10', min: 10, expDays: 21, supIdx: 3, status: 'AVAILABLE' },
      { name: 'Surgical Povidone Iodine Solution 500ml', category: 'Surgical', batch: 'PVP-2026-05', qty: 28, unit: 'Bottle', min: 15, expDays: 8, supIdx: 2, status: 'AVAILABLE' },

      // EDGE CASES: At least 2 Expired Items (expired before today, status EXPIRED)
      { name: 'Aspirin 75mg Gastro-Resistant', category: 'Medicines', batch: 'ASP-2025-X9', qty: 60, unit: 'Box of 100', min: 20, expDays: -45, supIdx: 0, status: 'EXPIRED' },
      { name: 'Viral Transport Medium (VTM) Swabs', category: 'Diagnostics', batch: 'VTM-2025-Z2', qty: 85, unit: 'Tube', min: 25, expDays: -20, supIdx: 3, status: 'EXPIRED' },

      // Additional Realistic Supplies (Indian hospital context)
      // Medicines
      { name: 'Insulin Regular Human 40IU/ml', category: 'Medicines', batch: 'INS-2026-H1', qty: 120, unit: 'Vial', min: 25, expDays: 300, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Salbutamol 100mcg Inhaler', category: 'Medicines', batch: 'SAL-2026-S1', qty: 80, unit: 'Inhaler', min: 20, expDays: 450, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Diclofenac 50mg Tablets', category: 'Medicines', batch: 'DIC-2026-D1', qty: 250, unit: 'Box of 100', min: 30, expDays: 365, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Furosemide 20mg Injection', category: 'Medicines', batch: 'FUR-2026-F1', qty: 150, unit: 'Ampoule', min: 25, expDays: 400, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Atropine 0.6mg Injection', category: 'Medicines', batch: 'ATR-2026-A1', qty: 100, unit: 'Ampoule', min: 20, expDays: 365, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Hydrocortisone 100mg Injection', category: 'Medicines', batch: 'HYD-2026-H1', qty: 90, unit: 'Vial', min: 20, expDays: 420, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Dexamethasone 4mg Injection', category: 'Medicines', batch: 'DEX-2026-D4', qty: 18, unit: 'Vial', min: 25, expDays: 300, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Tetanus Toxoid Vaccine', category: 'Medicines', batch: 'TTX-2026-T1', qty: 45, unit: 'Ampoule', min: 15, expDays: 26, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Heparin 5000IU/ml Injection', category: 'Medicines', batch: 'HEP-2026-H5', qty: 35, unit: 'Vial', min: 15, expDays: 18, supIdx: 0, status: 'AVAILABLE' },
      { name: 'Metronidazole 400mg Tablets', category: 'Medicines', batch: 'MET-2025-M4', qty: 0, unit: 'Box of 100', min: 30, expDays: -60, supIdx: 0, status: 'DISPOSED' },

      // Surgical
      { name: 'Surgical Blades #15', category: 'Surgical', batch: 'SBL-2026-15', qty: 150, unit: 'Box of 100', min: 25, expDays: 700, supIdx: 2, status: 'AVAILABLE' },
      { name: 'Foley Catheter 16Fr', category: 'Surgical', batch: 'FOL-2026-16', qty: 110, unit: 'Piece', min: 20, expDays: 600, supIdx: 2, status: 'AVAILABLE' },
      { name: 'Crepe Bandage 10cm', category: 'Surgical', batch: 'CRB-2026-10', qty: 140, unit: 'Roll', min: 30, expDays: 730, supIdx: 2, status: 'AVAILABLE' },
      { name: 'Plaster of Paris Bandage 15cm', category: 'Surgical', batch: 'POP-2026-15', qty: 9, unit: 'Roll', min: 25, expDays: 500, supIdx: 2, status: 'AVAILABLE' },
      { name: 'Vicryl Absorbable Suture 2-0', category: 'Surgical', batch: 'VIC-2026-20', qty: 80, unit: 'Box of 12', min: 20, expDays: 650, supIdx: 2, status: 'AVAILABLE' },

      // PPE
      { name: 'Surgical Face Masks 3-ply', category: 'PPE', batch: 'SFM-2026-3P', qty: 600, unit: 'Box of 50', min: 100, expDays: 730, supIdx: 1, status: 'AVAILABLE' },
      { name: 'Disposable Aprons', category: 'PPE', batch: 'APR-2026-D1', qty: 250, unit: 'Pack of 100', min: 40, expDays: 800, supIdx: 1, status: 'AVAILABLE' },
      { name: 'Disposable Shoe Covers', category: 'PPE', batch: 'SHC-2026-SC', qty: 14, unit: 'Pack of 50', min: 40, expDays: 600, supIdx: 1, status: 'AVAILABLE' },
      { name: 'Nitrile Examination Gloves (Large)', category: 'PPE', batch: 'GLV-2026-NL', qty: 300, unit: 'Box of 100', min: 50, expDays: 500, supIdx: 1, status: 'AVAILABLE' },

      // Diagnostics
      { name: 'Malaria Rapid Antigen Test Kit', category: 'Diagnostics', batch: 'MAL-2026-RT', qty: 120, unit: 'Kit of 25', min: 25, expDays: 365, supIdx: 3, status: 'AVAILABLE' },
      { name: 'Hepatitis B HBsAg Rapid Test Kit', category: 'Diagnostics', batch: 'HPB-2026-HB', qty: 30, unit: 'Kit of 25', min: 15, expDays: 12, supIdx: 3, status: 'AVAILABLE' },
      { name: 'COVID-19 Rapid Antigen Test Kit', category: 'Diagnostics', batch: 'COV-2025-RT', qty: 50, unit: 'Kit of 25', min: 20, expDays: -10, supIdx: 3, status: 'EXPIRED' },

      // Consumables (using Deccan Biomedical [supIdx 4] and Western Ghats [supIdx 5])
      { name: 'Nebulizer Masks (Adult)', category: 'Consumables', batch: 'NEB-2026-AD', qty: 130, unit: 'Piece', min: 25, expDays: 700, supIdx: 4, status: 'AVAILABLE' },
      { name: 'Oxygen Masks with Tubing', category: 'Consumables', batch: 'OXY-2026-TB', qty: 140, unit: 'Piece', min: 30, expDays: 650, supIdx: 5, status: 'AVAILABLE' },
      { name: 'Urine Collection Bags 2000ml', category: 'Consumables', batch: 'URB-2026-2K', qty: 11, unit: 'Piece', min: 30, expDays: 500, supIdx: 4, status: 'AVAILABLE' },
      { name: 'Medical Adhesive Tape 2.5cm', category: 'Consumables', batch: 'TAP-2026-25', qty: 200, unit: 'Roll', min: 35, expDays: 600, supIdx: 5, status: 'AVAILABLE' },
      { name: 'IV Infusion Sets', category: 'Consumables', batch: 'INF-2026-IV', qty: 350, unit: 'Box of 25', min: 50, expDays: 700, supIdx: 4, status: 'AVAILABLE' }
    ];

    const insertedSupplies = [];
    for (const item of suppliesData) {
      const expDate = addDays(item.expDays);
      const supplierId = suppliers[item.supIdx].supplier_id;
      const res = await client.query(`
        INSERT INTO medical_supply 
          (inventory_id, name, category, batch_no, quantity, unit, min_stock_level, expiry_date, supplier_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING supply_id, name, quantity, min_stock_level, status
      `, [inventoryId, item.name, item.category, item.batch, item.qty, item.unit, item.min, expDate, supplierId, item.status]);
      insertedSupplies.push(res.rows[0]);
    }

    // 6. Demo Supply Request for Department Staff (Emergency (Casualty) Department)
    console.log('Seeding initial supply requests...');
    const paracetamol = insertedSupplies.find(s => s.name.startsWith('Paracetamol'));
    const syringes = insertedSupplies.find(s => s.name.startsWith('Disposable Syringes 5ml'));

    if (paracetamol && staffUser) {
      await client.query(`
        INSERT INTO supply_request (supply_id, requested_by, department, quantity, status, request_date)
        VALUES ($1, $2, 'Emergency (Casualty)', 10, 'PENDING', CURRENT_TIMESTAMP - INTERVAL '2 hours')
      `, [paracetamol.supply_id, staffUser.user_id]);
    }

    if (syringes && staffUser) {
      await client.query(`
        INSERT INTO supply_request (supply_id, requested_by, department, quantity, status, request_date)
        VALUES ($1, $2, 'Emergency (Casualty)', 25, 'PENDING', CURRENT_TIMESTAMP - INTERVAL '5 hours')
      `, [syringes.supply_id, staffUser.user_id]);
    }

    // 13 Additional supply requests across various departments
    console.log('Seeding additional supply requests...');
    const moreRequests = [
      // 4 PENDING
      { name: 'Insulin Regular Human', dept: 'ICU', qty: 15, status: 'PENDING', reqDaysAgo: 1 },
      { name: 'Surgical Blades #15', dept: 'Operation Theatre', qty: 20, status: 'PENDING', reqDaysAgo: 2 },
      { name: 'Salbutamol 100mcg', dept: 'Pediatrics', qty: 10, status: 'PENDING', reqDaysAgo: 3 },
      { name: 'Pantoprazole 40mg', dept: 'Medicine Ward', qty: 25, status: 'PENDING', reqDaysAgo: 4 },
      // 6 APPROVED
      { name: 'Normal Saline 0.9%', dept: 'Emergency (Casualty)', qty: 30, status: 'APPROVED', reqDaysAgo: 14, decHoursLater: 3 },
      { name: 'Ondansetron 4mg', dept: 'ICU', qty: 20, status: 'APPROVED', reqDaysAgo: 12, decHoursLater: 2 },
      { name: 'Vicryl Absorbable', dept: 'Operation Theatre', qty: 15, status: 'APPROVED', reqDaysAgo: 10, decHoursLater: 4 },
      { name: 'Crepe Bandage 10cm', dept: 'Orthopedics', qty: 25, status: 'APPROVED', reqDaysAgo: 8, decHoursLater: 5 },
      { name: 'Malaria Rapid Antigen', dept: 'Laboratory', qty: 20, status: 'APPROVED', reqDaysAgo: 6, decHoursLater: 2 },
      { name: 'Oral Rehydration Salts', dept: 'Pediatrics', qty: 40, status: 'APPROVED', reqDaysAgo: 5, decHoursLater: 1 },
      // 3 REJECTED
      { name: 'Adrenaline (Epinephrine)', dept: 'ICU', qty: 50, status: 'REJECTED', reqDaysAgo: 11, decHoursLater: 3 },
      { name: 'Aspirin 75mg', dept: 'Medicine Ward', qty: 20, status: 'REJECTED', reqDaysAgo: 7, decHoursLater: 2 },
      { name: 'Endotracheal Tube', dept: 'Emergency (Casualty)', qty: 30, status: 'REJECTED', reqDaysAgo: 3, decHoursLater: 4 }
    ];

    for (const r of moreRequests) {
      const sup = insertedSupplies.find(s => s.name.startsWith(r.name));
      if (sup && staffUser) {
        if (r.status === 'PENDING') {
          await client.query(`
            INSERT INTO supply_request (supply_id, requested_by, department, quantity, status, request_date)
            VALUES ($1, $2, $3, $4, 'PENDING', CURRENT_TIMESTAMP - ($5 || ' days')::interval)
          `, [sup.supply_id, staffUser.user_id, r.dept, r.qty, r.reqDaysAgo]);
        } else {
          await client.query(`
            INSERT INTO supply_request (supply_id, requested_by, department, quantity, status, request_date, decided_by, decided_at)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP - ($6 || ' days')::interval, $7, CURRENT_TIMESTAMP - ($6 || ' days')::interval + ($8 || ' hours')::interval)
          `, [sup.supply_id, staffUser.user_id, r.dept, r.qty, r.status, r.reqDaysAgo, invUser.user_id, r.decHoursLater]);
        }
      }
    }

    // 7. Disposal Records (recorded_by the Inventory Manager)
    console.log('Seeding disposal records...');
    const metro = insertedSupplies.find(s => s.name.startsWith('Metronidazole 400mg'));
    const insSupply = insertedSupplies.find(s => s.name.startsWith('Insulin Regular Human'));
    const asp = insertedSupplies.find(s => s.name.startsWith('Aspirin 75mg'));
    const vtm = insertedSupplies.find(s => s.name.startsWith('Viral Transport Medium'));
    const gwnSupply = insertedSupplies.find(s => s.name.startsWith('Disposable Surgical Gowns'));

    const disposalsData = [
      { supply: metro, qty: 40, daysAgo: -45, reason: 'Metronidazole 40: Fully disposed batch expired 60 days ago.' },
      { supply: insSupply, qty: 6, daysAgo: -15, reason: 'Insulin 6: Cold chain storage breach during ward transfer.' },
      { supply: asp, qty: 25, daysAgo: -30, reason: 'Aspirin 25: Damaged packaging and moisture ingress during storage inspection.' },
      { supply: vtm, qty: 15, daysAgo: -10, reason: 'VTM 15: Expired viral transport medium swabs safely incinerated.' },
      { supply: gwnSupply, qty: 10, daysAgo: -20, reason: 'Surgical Gowns 10: Torn sterile outer packaging during pallet transit.' }
    ];

    for (const d of disposalsData) {
      if (d.supply && invUser) {
        await client.query(`
          INSERT INTO disposal_record (supply_id, quantity, disposal_date, reason, recorded_by)
          VALUES ($1, $2, $3, $4, $5)
        `, [d.supply.supply_id, d.qty, addDays(d.daysAgo), d.reason, invUser.user_id]);
      }
    }

    // 8. Increment 2 Purchase Orders (ORDERED, DISPATCHED, RECEIVED, DELAYED)
    console.log('Seeding purchase orders...');
    // Ensure dispatch_date column exists
    await client.query('ALTER TABLE purchase_order ADD COLUMN IF NOT EXISTS dispatch_date DATE');

    if (procureUser) {
      const sahyadriSupplier = suppliers[0];
      const bharatMediSupplier = suppliers[1];
      const konkanSupplier = suppliers[2];
      const lifelineSupplier = suppliers[3];
      const deccanSupplier = suppliers[4];
      const westernSupplier = suppliers[5];

      const pcm = insertedSupplies.find(s => s.name.startsWith('Paracetamol'));
      const amx = insertedSupplies.find(s => s.name.startsWith('Amoxicillin'));
      const ctx = insertedSupplies.find(s => s.name.startsWith('Ceftriaxone'));
      const ibu = insertedSupplies.find(s => s.name.startsWith('Ibuprofen'));
      const ns = insertedSupplies.find(s => s.name.startsWith('Normal Saline'));
      const gauze = insertedSupplies.find(s => s.name.startsWith('Sterile Gauze'));
      const adr = insertedSupplies.find(s => s.name.startsWith('Adrenaline'));

      // 1. ORDERED Order (Sahyadri Pharma Distributors) - Expected in 7 days
      const po1Res = await client.query(`
        INSERT INTO purchase_order (supplier_id, created_by, order_date, status, expected_date, notes)
        VALUES ($1, $2, CURRENT_DATE, 'ORDERED', $3, 'Routine quarterly replenishment for oral medications.')
        RETURNING order_id
      `, [sahyadriSupplier.supplier_id, procureUser.user_id, addDays(7)]);
      const po1Id = po1Res.rows[0].order_id;
      if (pcm) await client.query('INSERT INTO purchase_order_item (order_id, supply_id, quantity) VALUES ($1, $2, 100)', [po1Id, pcm.supply_id]);
      if (amx) await client.query('INSERT INTO purchase_order_item (order_id, supply_id, quantity) VALUES ($1, $2, 50)', [po1Id, amx.supply_id]);

      // 2. DISPATCHED Order (Sahyadri Pharma Distributors) - Dispatched yesterday, expected in 2 days
      const po2Res = await client.query(`
        INSERT INTO purchase_order (supplier_id, created_by, order_date, status, expected_date, dispatch_date, notes)
        VALUES ($1, $2, $3, 'DISPATCHED', $4, $5, 'Dispatched via MedExpress Logistics, Tracking #MX-889102. In transit to main warehouse.')
        RETURNING order_id
      `, [sahyadriSupplier.supplier_id, procureUser.user_id, addDays(-3), addDays(2), addDays(-1)]);
      const po2Id = po2Res.rows[0].order_id;
      if (ctx) await client.query('INSERT INTO purchase_order_item (order_id, supply_id, quantity) VALUES ($1, $2, 60)', [po2Id, ctx.supply_id]);
      if (ibu) await client.query('INSERT INTO purchase_order_item (order_id, supply_id, quantity) VALUES ($1, $2, 40)', [po2Id, ibu.supply_id]);

      // 3. RECEIVED Order (Bharat MediSupply Pvt. Ltd.) - Received 4 days ago
      const po3Res = await client.query(`
        INSERT INTO purchase_order (supplier_id, created_by, order_date, status, expected_date, dispatch_date, actual_date, notes)
        VALUES ($1, $2, $3, 'RECEIVED', $4, $5, $6, 'Delivered to central loading bay. All cartons verified against manifest.')
        RETURNING order_id
      `, [bharatMediSupplier.supplier_id, procureUser.user_id, addDays(-14), addDays(-5), addDays(-8), addDays(-4)]);
      const po3Id = po3Res.rows[0].order_id;
      if (ns) await client.query('INSERT INTO purchase_order_item (order_id, supply_id, quantity) VALUES ($1, $2, 150)', [po3Id, ns.supply_id]);
      if (gauze) await client.query('INSERT INTO purchase_order_item (order_id, supply_id, quantity) VALUES ($1, $2, 100)', [po3Id, gauze.supply_id]);

      // 4. DELAYED Order (Sahyadri Pharma Distributors) - Expected date 3 days ago, still ORDERED
      const po4Res = await client.query(`
        INSERT INTO purchase_order (supplier_id, created_by, order_date, status, expected_date, notes)
        VALUES ($1, $2, $3, 'ORDERED', $4, 'Urgent emergency stock order. Supplier notified of delay due to production scheduling.')
        RETURNING order_id
      `, [sahyadriSupplier.supplier_id, procureUser.user_id, addDays(-10), addDays(-3)]);
      const po4Id = po4Res.rows[0].order_id;
      if (adr) await client.query('INSERT INTO purchase_order_item (order_id, supply_id, quantity) VALUES ($1, $2, 50)', [po4Id, adr.supply_id]);

      // 16 Additional Purchase Orders (Total: 20)
      const panto = insertedSupplies.find(s => s.name.startsWith('Pantoprazole'));
      const met = insertedSupplies.find(s => s.name.startsWith('Metformin'));
      const sal = insertedSupplies.find(s => s.name.startsWith('Salbutamol'));
      const dic = insertedSupplies.find(s => s.name.startsWith('Diclofenac'));
      const atr = insertedSupplies.find(s => s.name.startsWith('Atropine'));
      const fur = insertedSupplies.find(s => s.name.startsWith('Furosemide'));
      const hyd = insertedSupplies.find(s => s.name.startsWith('Hydrocortisone'));
      const n95 = insertedSupplies.find(s => s.name.startsWith('N95 Respirator'));
      const apr = insertedSupplies.find(s => s.name.startsWith('Disposable Aprons'));
      const scp = insertedSupplies.find(s => s.name.startsWith('Surgical Scalpel'));
      const sut = insertedSupplies.find(s => s.name.startsWith('Silk Sutures'));
      const sbl = insertedSupplies.find(s => s.name.startsWith('Surgical Blades'));
      const vic = insertedSupplies.find(s => s.name.startsWith('Vicryl Absorbable'));
      const glu = insertedSupplies.find(s => s.name.startsWith('Blood Glucose'));
      const den = insertedSupplies.find(s => s.name.startsWith('Rapid Dengue'));
      const urn = insertedSupplies.find(s => s.name.startsWith('Urine Test'));
      const mal = insertedSupplies.find(s => s.name.startsWith('Malaria Rapid'));
      const neb = insertedSupplies.find(s => s.name.startsWith('Nebulizer Masks'));
      const urb = insertedSupplies.find(s => s.name.startsWith('Urine Collection'));
      const inf = insertedSupplies.find(s => s.name.startsWith('IV Infusion'));
      const oxy = insertedSupplies.find(s => s.name.startsWith('Oxygen Masks'));
      const tap = insertedSupplies.find(s => s.name.startsWith('Medical Adhesive'));

      const additionalOrders = [
        // Sahyadri (suppliers[0]): 6 orders (2 RECEIVED, 1 DISPATCHED, 1 ORDERED, 1 CANCELLED, 1 DELAYED)
        {
          sup: sahyadriSupplier, status: 'RECEIVED',
          oDays: -42, expDays: -32, dispDays: -35, actDays: -31,
          notes: 'Bulk gastro and diabetes medicines received and stock verified.',
          items: [{ sup: panto, qty: 80 }, { sup: met, qty: 100 }]
        },
        {
          sup: sahyadriSupplier, status: 'RECEIVED',
          oDays: -25, expDays: -15, dispDays: -18, actDays: -14,
          notes: 'Routine fever and analgesic tablets restock received.',
          items: [{ sup: pcm, qty: 120 }]
        },
        {
          sup: sahyadriSupplier, status: 'DISPATCHED',
          oDays: -5, expDays: 3, dispDays: -1, actDays: null,
          notes: 'Dispatched via SafeLogistics, tracking #SL-4412.',
          items: [{ sup: sal, qty: 40 }, { sup: dic, qty: 60 }]
        },
        {
          sup: sahyadriSupplier, status: 'ORDERED',
          oDays: -2, expDays: 6, dispDays: null, actDays: null,
          notes: 'Emergency critical care injection supplies ordered.',
          items: [{ sup: atr, qty: 50 }, { sup: fur, qty: 60 }]
        },
        {
          sup: sahyadriSupplier, status: 'CANCELLED',
          oDays: -20, expDays: -10, dispDays: null, actDays: null,
          notes: 'Order cancelled due to duplicate departmental requisition.',
          items: [{ sup: hyd, qty: 30 }]
        },
        {
          sup: sahyadriSupplier, status: 'ORDERED', // DELAYED
          oDays: -15, expDays: -5, dispDays: null, actDays: null,
          notes: 'Delayed due to factory packaging line maintenance at Pune facility.',
          items: [{ sup: insSupply, qty: 40 }, { sup: ctx, qty: 50 }]
        },

        // Bharat MediSupply (suppliers[1]): 2 orders (1 RECEIVED, 1 DISPATCHED)
        {
          sup: bharatMediSupplier, status: 'RECEIVED',
          oDays: -38, expDays: -28, dispDays: -30, actDays: -27,
          notes: 'Sterile PPE consumables received in good condition.',
          items: [{ sup: n95, qty: 100 }, { sup: gwnSupply, qty: 50 }]
        },
        {
          sup: bharatMediSupplier, status: 'DISPATCHED',
          oDays: -4, expDays: 4, dispDays: -1, actDays: null,
          notes: 'Consignment in transit with BlueDart MedExpress.',
          items: [{ sup: gauze, qty: 120 }, { sup: apr, qty: 60 }]
        },

        // Konkan Surgicals (suppliers[2]): 2 orders (1 DELAYED, 1 ORDERED)
        {
          sup: konkanSupplier, status: 'ORDERED', // DELAYED
          oDays: -18, expDays: -6, dispDays: null, actDays: null,
          notes: 'Supplier back-ordered surgical instruments; expedited delivery requested.',
          items: [{ sup: scp, qty: 40 }, { sup: sut, qty: 30 }]
        },
        {
          sup: konkanSupplier, status: 'ORDERED',
          oDays: -3, expDays: 7, dispDays: null, actDays: null,
          notes: 'Monthly surgical blades and sutures replenishment.',
          items: [{ sup: sbl, qty: 50 }, { sup: vic, qty: 40 }]
        },

        // Lifeline Diagnostics (suppliers[3]): 2 orders (1 RECEIVED, 1 DISPATCHED)
        {
          sup: lifelineSupplier, status: 'RECEIVED',
          oDays: -30, expDays: -20, dispDays: -22, actDays: -19,
          notes: 'Diagnostic reagents batch verified by laboratory technologist.',
          items: [{ sup: glu, qty: 60 }, { sup: den, qty: 30 }]
        },
        {
          sup: lifelineSupplier, status: 'DISPATCHED',
          oDays: -6, expDays: 2, dispDays: -2, actDays: null,
          notes: 'Dispatched in temperature-controlled vehicle.',
          items: [{ sup: urn, qty: 50 }, { sup: mal, qty: 40 }]
        },

        // Deccan Biomedical Supplies (suppliers[4]): 2 orders (1 DELAYED, 1 RECEIVED)
        {
          sup: deccanSupplier, status: 'ORDERED', // DELAYED
          oDays: -14, expDays: -4, dispDays: null, actDays: null,
          notes: 'Supply delayed due to raw material shipment hold at customs.',
          items: [{ sup: neb, qty: 50 }, { sup: urb, qty: 60 }]
        },
        {
          sup: deccanSupplier, status: 'RECEIVED',
          oDays: -22, expDays: -12, dispDays: -15, actDays: -11,
          notes: 'Infusion sets delivered to central store loading dock.',
          items: [{ sup: inf, qty: 100 }]
        },

        // Western Ghats Healthcare Traders (suppliers[5]): 2 orders (1 ORDERED, 1 RECEIVED)
        {
          sup: westernSupplier, status: 'ORDERED',
          oDays: -1, expDays: 8, dispDays: null, actDays: null,
          notes: 'Restock order for consumable adhesive tapes and tubing.',
          items: [{ sup: tap, qty: 80 }, { sup: oxy, qty: 50 }]
        },
        {
          sup: westernSupplier, status: 'RECEIVED',
          oDays: -35, expDays: -25, dispDays: -27, actDays: -24,
          notes: 'Initial consignment received and catalogued.',
          items: [{ sup: oxy, qty: 60 }]
        }
      ];

      for (const ord of additionalOrders) {
        const oDate = addDays(ord.oDays);
        const expDate = addDays(ord.expDays);
        const dispDate = ord.dispDays !== null ? addDays(ord.dispDays) : null;
        const actDate = ord.actDays !== null ? addDays(ord.actDays) : null;

        const poRes = await client.query(`
          INSERT INTO purchase_order (supplier_id, created_by, order_date, status, expected_date, dispatch_date, actual_date, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING order_id
        `, [ord.sup.supplier_id, procureUser.user_id, oDate, ord.status, expDate, dispDate, actDate, ord.notes]);

        const orderId = poRes.rows[0].order_id;
        for (const itm of ord.items) {
          if (itm.sup) {
            await client.query(`
              INSERT INTO purchase_order_item (order_id, supply_id, quantity)
              VALUES ($1, $2, $3)
            `, [orderId, itm.sup.supply_id, itm.qty]);
          }
        }
      }
    }

    await client.query('COMMIT');
    console.log('Database seeding completed successfully!');
    console.log(`Summary:
  - 1 Inventory Store
  - 2 System Settings
  - ${suppliers.length} Suppliers
  - 5 Role-based Demo Users
  - ${insertedSupplies.length} Medical Supplies with Low-Stock, Near-Expiry & Expired edge cases
  - 15 Department Supply Requests (6 PENDING, 6 APPROVED, 3 REJECTED)
  - 5 Disposal Records
  - 20 Purchase Orders (8 ORDERED [4 DELAYED], 4 DISPATCHED, 7 RECEIVED, 1 CANCELLED)
    `);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during database seeding:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
