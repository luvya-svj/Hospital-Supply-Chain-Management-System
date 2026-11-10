const request = require('supertest');
const app = require('../server/app');
const db = require('../server/config/db');
const { isExpired, isNearExpiry, isLowStock } = require('../server/utils/stockUtils');
const { evaluateAlerts } = require('../server/services/alertEngine');

describe('Increment 3 Test Suite — Expiry Management, Disposal, Alerts & Reports', () => {
  let adminCookie;
  let inventoryCookie;
  let procurementCookie;
  let staffCookie;
  let supplierCookie;
  let tc305Batch;

  beforeAll(async () => {
    // Authenticate all roles
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hscms.test', password: 'Admin@123' });
    adminCookie = adminRes.headers['set-cookie'];

    const invRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inventory@hscms.test', password: 'Inventory@123' });
    inventoryCookie = invRes.headers['set-cookie'];

    const procRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'procurement@hscms.test', password: 'Procure@123' });
    procurementCookie = procRes.headers['set-cookie'];

    const staffRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'staff@hscms.test', password: 'Staff@123' });
    staffCookie = staffRes.headers['set-cookie'];

    const supRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'supplier@hscms.test', password: 'Supplier@123' });
    supplierCookie = supRes.headers['set-cookie'];
  });

  afterAll(async () => {
    await db.pool.end();
  });

  // =========================================================================
  // TC-3.01: Near-expiry boundary (exactly N days = near expiry; N+1 days = not)
  // =========================================================================
  test('TC-3.01: Near-expiry boundary — item at exactly N days is near-expiry, N+1 is not', () => {
    const nearExpiryDays = 30;

    // Exactly N days from today (boundary inclusive)
    const atBoundary = new Date();
    atBoundary.setDate(atBoundary.getDate() + nearExpiryDays);
    const atBoundaryStr = atBoundary.toISOString().split('T')[0];
    expect(isNearExpiry(atBoundaryStr, nearExpiryDays)).toBe(true);

    // N+1 days from today (outside boundary)
    const outsideBoundary = new Date();
    outsideBoundary.setDate(outsideBoundary.getDate() + nearExpiryDays + 1);
    const outsideStr = outsideBoundary.toISOString().split('T')[0];
    expect(isNearExpiry(outsideStr, nearExpiryDays)).toBe(false);

    // 0 days (today) should be near-expiry
    const today = new Date().toISOString().split('T')[0];
    expect(isNearExpiry(today, nearExpiryDays)).toBe(true);
  });

  // =========================================================================
  // TC-3.02: Expired detection — supplies past expiry are auto-marked EXPIRED
  // =========================================================================
  test('TC-3.02: Expired supplies are automatically detected and status updated', async () => {
    // The GET /api/supplies auto-updates expired items
    const res = await request(app)
      .get('/api/supplies')
      .set('Cookie', inventoryCookie);

    expect(res.status).toBe(200);

    // Verify active expired items (excluding disposed) have status EXPIRED
    const expiredActive = res.body.supplies.filter(s => s.is_expired && s.status !== 'DISPOSED');
    expect(expiredActive.length).toBeGreaterThanOrEqual(2);

    // Each active expired supply must have status EXPIRED in the database
    expiredActive.forEach(item => {
      expect(item.status).toBe('EXPIRED');
    });

    // Unit function check
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    expect(isExpired(pastDate.toISOString().split('T')[0])).toBe(true);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    expect(isExpired(futureDate.toISOString().split('T')[0])).toBe(false);
  });

  // =========================================================================
  // TC-3.03: Disposal quantity cannot exceed available stock
  // =========================================================================
  test('TC-3.03: Disposal rejects quantity exceeding available stock', async () => {
    // Get a supply with known quantity
    const supRes = await request(app)
      .get('/api/supplies')
      .set('Cookie', inventoryCookie);

    const target = supRes.body.supplies.find(s => s.status === 'AVAILABLE' && s.quantity > 0);
    expect(target).toBeDefined();

    // Try to dispose more than available
    const res = await request(app)
      .post('/api/disposals')
      .set('Cookie', inventoryCookie)
      .send({
        supply_id: target.supply_id,
        quantity: target.quantity + 100,
        reason: 'Test excess disposal'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot exceed/i);
  });

  // =========================================================================
  // TC-3.04: Disposal creates record and reduces supply quantity
  // =========================================================================
  test('TC-3.04: Disposal creates disposal_record and reduces medical_supply quantity', async () => {
    // Find an expired supply with stock to dispose
    const supRes = await request(app)
      .get('/api/supplies')
      .set('Cookie', inventoryCookie);

    const target = supRes.body.supplies.find(s => s.status === 'EXPIRED' && s.quantity > 0);
    expect(target).toBeDefined();

    const originalQty = target.quantity;
    const disposeQty = 5;

    const res = await request(app)
      .post('/api/disposals')
      .set('Cookie', inventoryCookie)
      .send({
        supply_id: target.supply_id,
        quantity: disposeQty,
        reason: 'Expired — past safe usage date per hospital protocol.',
        disposal_date: new Date().toISOString().split('T')[0]
      });

    expect(res.status).toBe(201);
    expect(res.body.disposal).toBeDefined();
    expect(res.body.supply.remaining_quantity).toBe(originalQty - disposeQty);

    // Verify in database
    const checkRes = await request(app)
      .get(`/api/supplies/${target.supply_id}`)
      .set('Cookie', inventoryCookie);

    expect(checkRes.body.supply.quantity).toBe(originalQty - disposeQty);
  });

  // =========================================================================
  // TC-3.05: Disposal sets status DISPOSED when quantity reaches 0
  // =========================================================================
  test('TC-3.05: Disposing all remaining stock sets status to DISPOSED', async () => {
    // Create a temporary supply with unique batch to fully dispose
    tc305Batch = `TC305-${Date.now()}`;
    const addRes = await request(app)
      .post('/api/supplies')
      .set('Cookie', inventoryCookie)
      .send({
        name: `Test Disposal Supply ${tc305Batch}`,
        category: 'Diagnostics',
        batch_no: tc305Batch,
        quantity: 3,
        unit: 'Vial',
        min_stock_level: 5,
        expiry_date: new Date(Date.now() - 86400000).toISOString().split('T')[0] // yesterday = expired
      });

    expect(addRes.status).toBe(201);
    const supplyId = addRes.body.supply.supply_id;

    // Dispose all 3 units
    const dispRes = await request(app)
      .post('/api/disposals')
      .set('Cookie', inventoryCookie)
      .send({
        supply_id: supplyId,
        quantity: 3,
        reason: 'Full disposal — expired batch.'
      });

    expect(dispRes.status).toBe(201);
    expect(dispRes.body.supply.remaining_quantity).toBe(0);
    expect(dispRes.body.supply.status).toBe('DISPOSED');

    // Verify in database
    const checkRes = await request(app)
      .get(`/api/supplies/${supplyId}`)
      .set('Cookie', inventoryCookie);

    expect(checkRes.body.supply.status).toBe('DISPOSED');
    expect(checkRes.body.supply.quantity).toBe(0);
  });

  // =========================================================================
  // TC-3.06: Alert engine generates LOW_STOCK alert
  // =========================================================================
  test('TC-3.06: Alert engine creates LOW_STOCK alerts for items at or below min_stock_level', async () => {
    await evaluateAlerts();

    const res = await request(app)
      .get('/api/alerts?type=LOW_STOCK')
      .set('Cookie', inventoryCookie);

    expect(res.status).toBe(200);
    // Seeded data has at least 4 low-stock items (Adrenaline, Nitrile Gloves, ETT, Syringes 10ml)
    expect(res.body.alerts.length).toBeGreaterThanOrEqual(3);

    // Each alert should reference a supply
    res.body.alerts.forEach(a => {
      expect(a.type).toBe('LOW_STOCK');
      expect(a.supply_id).not.toBeNull();
      expect(a.is_resolved).toBe(false);
    });
  });

  // =========================================================================
  // TC-3.07: Alert engine generates NEAR_EXPIRY and EXPIRED alerts
  // =========================================================================
  test('TC-3.07: Alert engine creates NEAR_EXPIRY and EXPIRED alerts accurately', async () => {
    await evaluateAlerts();

    const nearRes = await request(app)
      .get('/api/alerts?type=NEAR_EXPIRY')
      .set('Cookie', inventoryCookie);
    expect(nearRes.status).toBe(200);
    // Seeded: Human Albumin (14d), Troponin-I (21d), Povidone Iodine (8d)
    expect(nearRes.body.alerts.length).toBeGreaterThanOrEqual(2);

    const expRes = await request(app)
      .get('/api/alerts?type=EXPIRED')
      .set('Cookie', inventoryCookie);
    expect(expRes.status).toBe(200);
    // Seeded: Aspirin and VTM expired items (those with remaining stock)
    expect(expRes.body.alerts.length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // TC-3.08: Alert engine generates DELAYED_DELIVERY for past-due orders
  // =========================================================================
  test('TC-3.08: Alert engine creates DELAYED_DELIVERY alert for overdue purchase orders', async () => {
    await evaluateAlerts();

    const res = await request(app)
      .get('/api/alerts?type=DELAYED_DELIVERY')
      .set('Cookie', procurementCookie);

    expect(res.status).toBe(200);
    // Seeded PO #4 is delayed (expected_date -3 days, status ORDERED)
    expect(res.body.alerts.length).toBeGreaterThanOrEqual(1);

    const delayedAlert = res.body.alerts[0];
    expect(delayedAlert.type).toBe('DELAYED_DELIVERY');
    expect(delayedAlert.order_id).not.toBeNull();
  });

  // =========================================================================
  // TC-3.09: No duplicate active alerts for the same condition
  // =========================================================================
  test('TC-3.09: Alert deduplication — running engine twice does not create duplicate alerts', async () => {
    // Run alert engine twice
    await evaluateAlerts();
    await evaluateAlerts();

    // Check LOW_STOCK alerts — no duplicates for same supply_id
    const res = await request(app)
      .get('/api/alerts?type=LOW_STOCK')
      .set('Cookie', inventoryCookie);

    const supplyIdCounts = {};
    res.body.alerts.forEach(a => {
      supplyIdCounts[a.supply_id] = (supplyIdCounts[a.supply_id] || 0) + 1;
    });

    // Each supply should have at most 1 unresolved LOW_STOCK alert
    Object.values(supplyIdCounts).forEach(count => {
      expect(count).toBe(1);
    });
  });

  // =========================================================================
  // TC-3.10: Alerts auto-resolve when condition is cleared
  // =========================================================================
  test('TC-3.10: Alert auto-resolves when condition clears (supply disposed)', async () => {
    // The supply we fully disposed in TC-3.05 should have its EXPIRED alert resolved
    await evaluateAlerts();

    // Check that the fully disposed supply has no unresolved alerts
    const res = await request(app)
      .get('/api/alerts')
      .set('Cookie', inventoryCookie);

    const tc305Alerts = res.body.alerts.filter(a =>
      a.supply_name && tc305Batch && a.supply_name.includes(tc305Batch) && !a.is_resolved
    );
    expect(tc305Alerts.length).toBe(0);
  });

  // =========================================================================
  // TC-3.11: Role-based alert visibility
  // =========================================================================
  test('TC-3.11: Role-based alert filtering — each role sees only relevant alerts', async () => {
    // Inventory Manager: LOW_STOCK, NEAR_EXPIRY, EXPIRED
    const invRes = await request(app)
      .get('/api/alerts')
      .set('Cookie', inventoryCookie);
    expect(invRes.status).toBe(200);
    invRes.body.alerts.forEach(a => {
      expect(['LOW_STOCK', 'NEAR_EXPIRY', 'EXPIRED']).toContain(a.type);
    });

    // Procurement Officer: DELAYED_DELIVERY only
    const procRes = await request(app)
      .get('/api/alerts')
      .set('Cookie', procurementCookie);
    expect(procRes.status).toBe(200);
    procRes.body.alerts.forEach(a => {
      expect(a.type).toBe('DELAYED_DELIVERY');
    });

    // Administrator: all types
    const adminRes = await request(app)
      .get('/api/alerts')
      .set('Cookie', adminCookie);
    expect(adminRes.status).toBe(200);
    // Admin should see alerts from all types that exist
    const adminTypes = new Set(adminRes.body.alerts.map(a => a.type));
    expect(adminTypes.size).toBeGreaterThanOrEqual(2);

    // Department Staff: no alerts
    const staffRes = await request(app)
      .get('/api/alerts')
      .set('Cookie', staffCookie);
    expect(staffRes.status).toBe(200);
    expect(staffRes.body.alerts.length).toBe(0);
  });

  // =========================================================================
  // TC-3.12: Report data and totals match seeded records
  // =========================================================================
  test('TC-3.12: Inventory and Procurement report totals are consistent with data', async () => {
    // Inventory Report
    const invReport = await request(app)
      .get('/api/reports/inventory')
      .set('Cookie', adminCookie);

    expect(invReport.status).toBe(200);
    expect(invReport.body.summary).toBeDefined();
    expect(invReport.body.supplies).toBeDefined();
    expect(invReport.body.summary.total_items).toBe(invReport.body.supplies.length);

    // Total quantity should be sum of all supply quantities
    const calculatedTotal = invReport.body.supplies.reduce((sum, s) => sum + Number(s.quantity), 0);
    expect(invReport.body.summary.total_quantity).toBe(calculatedTotal);

    // Procurement Report
    const procReport = await request(app)
      .get('/api/reports/procurement')
      .set('Cookie', adminCookie);

    expect(procReport.status).toBe(200);
    expect(procReport.body.summary).toBeDefined();
    expect(procReport.body.orders).toBeDefined();
    expect(procReport.body.summary.total_orders).toBe(procReport.body.orders.length);
  });

  // =========================================================================
  // TC-3.13: Reports restricted to Hospital Administrator (non-admin gets 403)
  // =========================================================================
  test('TC-3.13: Reports API returns 403 for non-administrator roles', async () => {
    // Inventory Manager
    const invRes = await request(app)
      .get('/api/reports/inventory')
      .set('Cookie', inventoryCookie);
    expect(invRes.status).toBe(403);

    // Procurement Officer
    const procRes = await request(app)
      .get('/api/reports/procurement')
      .set('Cookie', procurementCookie);
    expect(procRes.status).toBe(403);

    // Department Staff
    const staffRes = await request(app)
      .get('/api/reports/inventory')
      .set('Cookie', staffCookie);
    expect(staffRes.status).toBe(403);

    // Supplier
    const supRes = await request(app)
      .get('/api/reports/procurement')
      .set('Cookie', supplierCookie);
    expect(supRes.status).toBe(403);
  });

  // =========================================================================
  // TC-3.14: Automatic EXPIRED marking across alertEngine.evaluate(), dashboard, search, and requests
  // =========================================================================
  test('TC-3.14: Expired supplies are marked EXPIRED automatically by alertEngine.evaluate() and excluded from available stock', async () => {
    // 1. Get existing inventory_id and insert a temporary supply with a past expiry date and status initially 'AVAILABLE'
    const invRes = await db.pool.query('SELECT inventory_id FROM inventory LIMIT 1');
    const invId = invRes.rows[0]?.inventory_id || 1;

    const pastExpDate = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
    const uniqueBatch = `EXP-TEST-${Date.now()}`;
    const insertRes = await db.pool.query(`
      INSERT INTO medical_supply 
        (inventory_id, name, category, batch_no, quantity, unit, min_stock_level, expiry_date, status)
      VALUES ($1, $2, 'Medicines', $3, 50, 'Box of 100', 10, $4, 'AVAILABLE')
      RETURNING supply_id, status
    `, [invId, `Expired Test Item ${uniqueBatch}`, uniqueBatch, pastExpDate]);

    const testSupplyId = insertRes.rows[0].supply_id;
    expect(insertRes.rows[0].status).toBe('AVAILABLE');

    // 2. Run alertEngine.evaluate()
    await evaluateAlerts();

    // 3. Verify status in database was automatically updated to 'EXPIRED'
    const statusCheck = await db.pool.query('SELECT status FROM medical_supply WHERE supply_id = $1', [testSupplyId]);
    expect(statusCheck.rows[0].status).toBe('EXPIRED');

    // 4. Verify department staff cannot request this expired item
    const reqRes = await request(app)
      .post('/api/requests')
      .set('Cookie', staffCookie)
      .send({
        supply_id: testSupplyId,
        department: 'Emergency',
        quantity: 5
      });

    expect(reqRes.status).toBe(400);
    expect(reqRes.body.error).toMatch(/expired/i);

    // 5. Clean up temporary test supply
    await db.pool.query('DELETE FROM alert WHERE supply_id = $1', [testSupplyId]);
    await db.pool.query('DELETE FROM medical_supply WHERE supply_id = $1', [testSupplyId]);
  });
});
