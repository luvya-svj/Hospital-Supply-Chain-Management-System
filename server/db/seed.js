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
      ('Lifeline Diagnostics Traders', '+91-22-5550-0482', 'support@lifelinediagnostics.test', 'Sector 19, Vashi, Navi Mumbai, Maharashtra 400703', true)
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
      { name: 'Viral Transport Medium (VTM) Swabs', category: 'Diagnostics', batch: 'VTM-2025-Z2', qty: 85, unit: 'Tube', min: 25, expDays: -20, supIdx: 3, status: 'EXPIRED' }
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

    // 7. Increment 2 Purchase Orders (ORDERED, DISPATCHED, RECEIVED, DELAYED)
    console.log('Seeding purchase orders...');
    // Ensure dispatch_date column exists
    await client.query('ALTER TABLE purchase_order ADD COLUMN IF NOT EXISTS dispatch_date DATE');

    if (procureUser) {
      const sahyadriSupplier = suppliers[0];
      const bharatMediSupplier = suppliers[1];

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
    }

    await client.query('COMMIT');
    console.log('Database seeding completed successfully!');
    console.log(`Summary:
  - 1 Inventory Store
  - 2 System Settings
  - 4 Suppliers
  - 5 Role-based Demo Users
  - ${insertedSupplies.length} Medical Supplies with Low-Stock, Near-Expiry & Expired edge cases
  - 2 Pending Department Supply Requests
  - 4 Purchase Orders (1 ORDERED, 1 DISPATCHED, 1 RECEIVED, 1 DELAYED)
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
