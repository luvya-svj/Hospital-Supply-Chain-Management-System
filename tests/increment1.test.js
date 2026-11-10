const request = require('supertest');
const app = require('../server/app');
const db = require('../server/config/db');
const { isExpired, isNearExpiry, isLowStock, computeStockStatus } = require('../server/utils/stockUtils');

describe('Increment 1 Test Suite — Hospital Supply Chain Management System', () => {
  let adminCookie;
  let inventoryCookie;
  let staffCookie;

  beforeAll(async () => {
    // Authenticate Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hscms.test', password: 'Admin@123' });
    adminCookie = adminRes.headers['set-cookie'];

    // Authenticate Inventory Manager
    const invRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inventory@hscms.test', password: 'Inventory@123' });
    inventoryCookie = invRes.headers['set-cookie'];

    // Authenticate Hospital Department Staff
    const staffRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'staff@hscms.test', password: 'Staff@123' });
    staffCookie = staffRes.headers['set-cookie'];
  });

  afterAll(async () => {
    await db.pool.end();
  });

  // TC-1.01: Login Success
  test('TC-1.01: Login success returns session cookie and authenticated user details', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hscms.test', password: 'Admin@123' });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('admin@hscms.test');
    expect(res.body.user.role).toBe('Hospital Administrator');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  // TC-1.02: Login Failure with invalid password
  test('TC-1.02: Login failure with wrong password returns 401 error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hscms.test', password: 'WrongPassword999' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });

  // TC-1.03: Deactivated User Blocked
  test('TC-1.03: Deactivated user account is blocked from logging in with 403', async () => {
    // Create deactivated user
    const uniqueEmail = `deactivated_${Date.now()}@hscms.test`;
    await request(app)
      .post('/api/users')
      .set('Cookie', adminCookie)
      .send({
        name: 'Deactivated User',
        email: uniqueEmail,
        password: 'Password@123',
        role: 'Hospital Department Staff',
        department: 'Pediatrics'
      });

    // Fetch created user ID to deactivate
    const usersRes = await request(app).get('/api/users').set('Cookie', adminCookie);
    const targetUser = usersRes.body.users.find(u => u.email === uniqueEmail);
    expect(targetUser).toBeDefined();

    await request(app)
      .patch(`/api/users/${targetUser.user_id}/status`)
      .set('Cookie', adminCookie)
      .send({ is_active: false });

    // Attempt login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail, password: 'Password@123' });

    expect(loginRes.status).toBe(403);
    expect(loginRes.body.error).toMatch(/deactivated/i);
  });

  // TC-1.04: Unauthenticated access blocked
  test('TC-1.04: Unauthenticated access to protected API endpoint returns 401', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/authentication required/i);
  });

  // TC-1.05: Role Permission Check (Staff cannot access User Management)
  test('TC-1.05: Role permission enforcement - Hospital Department Staff forbidden from /api/users (403)', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Cookie', staffCookie);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/access denied/i);
  });

  // TC-1.06: Admin user creation and duplicate email rejection
  test('TC-1.06: Admin user creation succeeds and duplicate email is rejected (400)', async () => {
    const testEmail = `newuser_${Date.now()}@hscms.test`;

    const createRes = await request(app)
      .post('/api/users')
      .set('Cookie', adminCookie)
      .send({
        name: 'Test Staff',
        email: testEmail,
        password: 'Pass@12345',
        role: 'Hospital Department Staff',
        department: 'Cardiology'
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.user.email).toBe(testEmail);

    // Try duplicate email
    const dupRes = await request(app)
      .post('/api/users')
      .set('Cookie', adminCookie)
      .send({
        name: 'Duplicate Staff',
        email: testEmail,
        password: 'Pass@12345',
        role: 'Hospital Department Staff',
        department: 'Cardiology'
      });

    expect(dupRes.status).toBe(400);
    expect(dupRes.body.error).toMatch(/already exists/i);
  });

  // TC-1.07: Admin cannot deactivate own account
  test('TC-1.07: Administrator is blocked from deactivating their own account (400)', async () => {
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', adminCookie);

    const adminId = meRes.body.user.user_id;

    const res = await request(app)
      .patch(`/api/users/${adminId}/status`)
      .set('Cookie', adminCookie)
      .send({ is_active: false });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot deactivate their own account/i);
  });

  // TC-1.08: Supply creation with duplicate (name, batch_no) rejected
  test('TC-1.08: Medical supply creation rejects duplicate (name, batch_no) with 400', async () => {
    const batch = `TEST-BATCH-${Date.now()}`;
    const name = 'Sterile Saline Solution';

    const firstRes = await request(app)
      .post('/api/supplies')
      .set('Cookie', inventoryCookie)
      .send({
        name,
        category: 'Medicines',
        batch_no: batch,
        quantity: 50,
        unit: 'Bottle',
        min_stock_level: 10,
        expiry_date: '2028-12-31'
      });

    expect(firstRes.status).toBe(201);

    const dupRes = await request(app)
      .post('/api/supplies')
      .set('Cookie', inventoryCookie)
      .send({
        name,
        category: 'Medicines',
        batch_no: batch,
        quantity: 20,
        unit: 'Bottle',
        min_stock_level: 10,
        expiry_date: '2028-12-31'
      });

    expect(dupRes.status).toBe(400);
    expect(dupRes.body.error).toMatch(/already exists/i);
  });

  // TC-1.09: Supply validation errors
  test('TC-1.09: Supply creation validates required fields and negative quantities', async () => {
    const invalidQtyRes = await request(app)
      .post('/api/supplies')
      .set('Cookie', inventoryCookie)
      .send({
        name: 'Invalid Qty Drug',
        category: 'Medicines',
        batch_no: `INV-${Date.now()}`,
        quantity: -15,
        unit: 'Vial',
        min_stock_level: 10,
        expiry_date: '2027-10-10'
      });

    expect(invalidQtyRes.status).toBe(400);

    const missingFieldsRes = await request(app)
      .post('/api/supplies')
      .set('Cookie', inventoryCookie)
      .send({
        name: 'Missing Fields'
      });

    expect(missingFieldsRes.status).toBe(400);
  });

  // TC-1.10: Stock status calculations
  test('TC-1.10: Unit calculation of stock flags (isLowStock, isExpired, isNearExpiry, computeStockStatus)', () => {
    const pastDate = '2020-01-01';
    const futureDate = '2029-01-01';
    
    const d = new Date();
    d.setDate(d.getDate() + 10);
    const nearDate = d.toISOString().split('T')[0];

    expect(isExpired(pastDate)).toBe(true);
    expect(isExpired(futureDate)).toBe(false);

    expect(isNearExpiry(nearDate, 30)).toBe(true);
    expect(isNearExpiry(futureDate, 30)).toBe(false);

    expect(isLowStock(5, 10, 'AVAILABLE')).toBe(true);
    expect(isLowStock(15, 10, 'AVAILABLE')).toBe(false);
    expect(isLowStock(5, 10, 'EXPIRED')).toBe(false);

    expect(computeStockStatus({ status: 'AVAILABLE', quantity: 5, min_stock_level: 10, expiry_date: futureDate })).toBe('LOW_STOCK');
    expect(computeStockStatus({ status: 'AVAILABLE', quantity: 50, min_stock_level: 10, expiry_date: futureDate })).toBe('OK');
    expect(computeStockStatus({ status: 'AVAILABLE', quantity: 50, min_stock_level: 10, expiry_date: pastDate })).toBe('EXPIRED');
  });

  // TC-1.11: Supply request rejected for expired or insufficient stock
  test('TC-1.11: Supply request is rejected when item is expired or requested quantity exceeds available stock', async () => {
    // Find an expired supply
    const suppliesRes = await request(app).get('/api/supplies').set('Cookie', staffCookie);
    const expiredItem = suppliesRes.body.supplies.find(s => s.is_expired);
    const validItem = suppliesRes.body.supplies.find(s => !s.is_expired && s.quantity > 0);

    expect(expiredItem).toBeDefined();
    expect(validItem).toBeDefined();

    // Requesting expired item
    const expReqRes = await request(app)
      .post('/api/requests')
      .set('Cookie', staffCookie)
      .send({
        supply_id: expiredItem.supply_id,
        department: 'Emergency',
        quantity: 1
      });

    expect(expReqRes.status).toBe(400);
    expect(expReqRes.body.error).toMatch(/expired/i);

    // Requesting more than available stock
    const excessReqRes = await request(app)
      .post('/api/requests')
      .set('Cookie', staffCookie)
      .send({
        supply_id: validItem.supply_id,
        department: 'Emergency',
        quantity: validItem.quantity + 500
      });

    expect(excessReqRes.status).toBe(400);
    expect(excessReqRes.body.error).toMatch(/exceeds/i);
  });

  // TC-1.12: Supply request approval deducts stock
  test('TC-1.12: Approving a supply request deducts the quantity from medical_supply table', async () => {
    // 1. Create a fresh supply item for testing approval
    const testBatch = `REQ-${Date.now()}`;
    const initialQty = 80;
    const reqQty = 15;

    const supplyRes = await request(app)
      .post('/api/supplies')
      .set('Cookie', inventoryCookie)
      .send({
        name: 'Surgical Gloves Test Batch',
        category: 'PPE',
        batch_no: testBatch,
        quantity: initialQty,
        unit: 'Box of 100',
        min_stock_level: 20,
        expiry_date: '2028-06-30'
      });

    const supplyId = supplyRes.body.supply.supply_id;

    // 2. Staff creates request
    const reqCreateRes = await request(app)
      .post('/api/requests')
      .set('Cookie', staffCookie)
      .send({
        supply_id: supplyId,
        department: 'Emergency',
        quantity: reqQty
      });

    expect(reqCreateRes.status).toBe(201);
    const requestId = reqCreateRes.body.request.request_id;

    // 3. Inventory Manager approves request
    const approveRes = await request(app)
      .post(`/api/requests/${requestId}/decide`)
      .set('Cookie', inventoryCookie)
      .send({ action: 'APPROVE' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.request.status).toBe('APPROVED');

    // 4. Verify stock in medical_supply was deducted
    const checkSupplyRes = await request(app)
      .get(`/api/supplies/${supplyId}`)
      .set('Cookie', inventoryCookie);

    expect(checkSupplyRes.body.supply.quantity).toBe(initialQty - reqQty);
  });

  // TC-1.13: System Settings Management
  test('TC-1.13: System Settings Management - Admin can view and update system settings', async () => {
    // 1. Get settings
    const getRes = await request(app)
      .get('/api/settings')
      .set('Cookie', adminCookie);

    expect(getRes.status).toBe(200);
    expect(getRes.body.settings).toBeDefined();
    expect(getRes.body.settings.near_expiry_days).toBeDefined();
    expect(getRes.body.settings.default_min_stock_level).toBeDefined();

    // 2. Non-admin forbidden
    const nonAdminRes = await request(app)
      .get('/api/settings')
      .set('Cookie', staffCookie);
    expect(nonAdminRes.status).toBe(403);

    // 3. Update settings
    const putRes = await request(app)
      .put('/api/settings')
      .set('Cookie', adminCookie)
      .send({ near_expiry_days: 35, default_min_stock_level: 25 });

    expect(putRes.status).toBe(200);
    expect(putRes.body.settings.near_expiry_days).toBe('35');

    // 4. Restore original default
    await request(app)
      .put('/api/settings')
      .set('Cookie', adminCookie)
      .send({ near_expiry_days: 30, default_min_stock_level: 20 });
  });

  // TC-1.14: Search & View Supplies
  test('TC-1.14: Search & View Supplies - keyword search, category filter, and single supply details', async () => {
    // 1. Search by name
    const searchRes = await request(app)
      .get('/api/supplies?search=Paracetamol')
      .set('Cookie', staffCookie);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.supplies.length).toBeGreaterThanOrEqual(1);
    expect(searchRes.body.supplies[0].name).toMatch(/Paracetamol/i);

    // 2. Categories endpoint
    const catRes = await request(app)
      .get('/api/supplies/categories')
      .set('Cookie', staffCookie);

    expect(catRes.status).toBe(200);
    expect(Array.isArray(catRes.body.categories)).toBe(true);
    expect(catRes.body.categories).toContain('Medicines');

    // 3. Single supply view
    const targetSupply = searchRes.body.supplies[0];
    const detailRes = await request(app)
      .get(`/api/supplies/${targetSupply.supply_id}`)
      .set('Cookie', staffCookie);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.supply.name).toBe(targetSupply.name);
    expect(detailRes.body.supply.computed_status).toBeDefined();
  });

  // TC-1.15: Role Dashboard Overview
  test('TC-1.15: Role Dashboard Overview - returns tailored statistics and store status for authenticated user', async () => {
    // Admin dashboard
    const adminDash = await request(app)
      .get('/api/dashboard/stats')
      .set('Cookie', adminCookie);

    expect(adminDash.status).toBe(200);
    expect(adminDash.body.stats.role).toBe('Hospital Administrator');
    expect(adminDash.body.stats.totalUsers).toBeDefined();
    expect(adminDash.body.stats.activeUsers).toBeDefined();
    expect(adminDash.body.stats.storeInfo).toBeDefined();

    // Staff dashboard
    const staffDash = await request(app)
      .get('/api/dashboard/stats')
      .set('Cookie', staffCookie);

    expect(staffDash.status).toBe(200);
    expect(staffDash.body.stats.role).toBe('Hospital Department Staff');
    expect(staffDash.body.stats.myPendingRequests).toBeDefined();
    expect(staffDash.body.stats.availableCatalogItems).toBeDefined();
  });
});
