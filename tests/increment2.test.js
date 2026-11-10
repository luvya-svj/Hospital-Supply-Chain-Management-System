const request = require('supertest');
const app = require('../server/app');
const db = require('../server/config/db');

describe('Increment 2 Test Suite — Supplier Management, Procurement & Delivery Tracking', () => {
  let adminCookie;
  let procureCookie;
  let supplierCookie;
  let staffCookie;
  let testSupplierId;
  let testSupplyId;

  beforeAll(async () => {
    // 1. Authenticate Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hscms.test', password: 'Admin@123' });
    adminCookie = adminRes.headers['set-cookie'];

    // 2. Authenticate Procurement Officer
    const procureRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'procurement@hscms.test', password: 'Procure@123' });
    procureCookie = procureRes.headers['set-cookie'];

    // 3. Authenticate Supplier / Vendor (Amit Shah)
    const supplierRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'supplier@hscms.test', password: 'Supplier@123' });
    supplierCookie = supplierRes.headers['set-cookie'];

    // 4. Authenticate Staff
    const staffRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'staff@hscms.test', password: 'Staff@123' });
    staffCookie = staffRes.headers['set-cookie'];

    // Fetch an available supply ID for testing orders
    const supRes = await request(app).get('/api/supplies').set('Cookie', procureCookie);
    const availableSupply = supRes.body.supplies.find(s => s.status === 'AVAILABLE');
    testSupplyId = availableSupply.supply_id;

    // Fetch Sahyadri supplier ID
    const suppliersRes = await request(app).get('/api/suppliers').set('Cookie', procureCookie);
    const apex = suppliersRes.body.suppliers.find(s => s.name === 'Sahyadri Pharma Distributors');
    testSupplierId = apex.supplier_id;
  });

  afterAll(async () => {
    await db.pool.end();
  });

  // TC-2.01: Supplier validation (required fields and valid email)
  test('TC-2.01: Supplier creation validates required fields and email format', async () => {
    // Missing name
    const resNoName = await request(app)
      .post('/api/suppliers')
      .set('Cookie', procureCookie)
      .send({ email: 'test@supplier.com' });
    expect(resNoName.status).toBe(400);
    expect(resNoName.body.error).toMatch(/name is required/i);

    // Missing email
    const resNoEmail = await request(app)
      .post('/api/suppliers')
      .set('Cookie', procureCookie)
      .send({ name: 'BioTech North' });
    expect(resNoEmail.status).toBe(400);
    expect(resNoEmail.body.error).toMatch(/email is required/i);

    // Invalid email format
    const resBadEmail = await request(app)
      .post('/api/suppliers')
      .set('Cookie', procureCookie)
      .send({ name: 'BioTech North', email: 'not-an-email' });
    expect(resBadEmail.status).toBe(400);
    expect(resBadEmail.body.error).toMatch(/invalid email format/i);

    // Valid supplier
    const resSuccess = await request(app)
      .post('/api/suppliers')
      .set('Cookie', procureCookie)
      .send({
        name: 'OmniHealth Supplies Ltd',
        contact: '+1-555-8833',
        email: 'sales@omnihealth.com',
        address: '500 Commerce Way, Boston, MA'
      });
    expect(resSuccess.status).toBe(201);
    expect(resSuccess.body.supplier.name).toBe('OmniHealth Supplies Ltd');
    expect(resSuccess.body.supplier.is_active).toBe(true);
  });

  // TC-2.02: Inactive suppliers cannot be selected for new purchase orders
  test('TC-2.02: Deactivating a supplier blocks selecting it for new orders', async () => {
    // Create new supplier
    const supRes = await request(app)
      .post('/api/suppliers')
      .set('Cookie', procureCookie)
      .send({ name: 'Inactive Test Supplier', email: 'inactive@test.com' });
    const sId = supRes.body.supplier.supplier_id;

    // Deactivate supplier
    const deactRes = await request(app)
      .patch(`/api/suppliers/${sId}/status`)
      .set('Cookie', procureCookie)
      .send({ is_active: false });
    expect(deactRes.status).toBe(200);
    expect(deactRes.body.supplier.is_active).toBe(false);

    // Attempt to create purchase order with inactive supplier
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Cookie', procureCookie)
      .send({
        supplier_id: sId,
        expected_date: '2026-12-31',
        items: [{ supply_id: testSupplyId, quantity: 10 }]
      });
    expect(orderRes.status).toBe(400);
    expect(orderRes.body.error).toMatch(/inactive supplier/i);
  });

  // TC-2.03: Order creation rejects expected date in the past
  test('TC-2.03: Purchase order creation rejects expected delivery date in the past', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', procureCookie)
      .send({
        supplier_id: testSupplierId,
        expected_date: '2020-01-01', // Date in the past
        items: [{ supply_id: testSupplyId, quantity: 15 }]
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expected delivery date cannot be in the past/i);
  });

  // TC-2.04: Order creation rejects duplicate items and non-positive quantities
  test('TC-2.04: Order creation rejects duplicate items and non-positive quantity', async () => {
    // Duplicate items in single order
    const resDuplicate = await request(app)
      .post('/api/orders')
      .set('Cookie', procureCookie)
      .send({
        supplier_id: testSupplierId,
        expected_date: '2026-12-31',
        items: [
          { supply_id: testSupplyId, quantity: 5 },
          { supply_id: testSupplyId, quantity: 10 }
        ]
      });
    expect(resDuplicate.status).toBe(400);
    expect(resDuplicate.body.error).toMatch(/duplicate items/i);

    // Negative or zero quantity
    const resZeroQty = await request(app)
      .post('/api/orders')
      .set('Cookie', procureCookie)
      .send({
        supplier_id: testSupplierId,
        expected_date: '2026-12-31',
        items: [{ supply_id: testSupplyId, quantity: 0 }]
      });
    expect(resZeroQty.status).toBe(400);
    expect(resZeroQty.body.error).toMatch(/positive integer/i);
  });

  // TC-2.05: Order creation starts as ORDERED and saves items correctly
  test('TC-2.05: Order creation starts with status ORDERED and saves items correctly', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', procureCookie)
      .send({
        supplier_id: testSupplierId,
        expected_date: '2026-11-30',
        notes: 'Urgent ward restock order',
        items: [{ supply_id: testSupplyId, quantity: 20 }]
      });

    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('ORDERED');
    expect(res.body.order.supplier_id).toBe(testSupplierId);

    const orderId = res.body.order.order_id;
    // Check order details endpoint
    const detailRes = await request(app).get(`/api/orders/${orderId}`).set('Cookie', procureCookie);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.order.status).toBe('ORDERED');
    expect(detailRes.body.items.length).toBe(1);
    expect(detailRes.body.items[0].supply_id).toBe(testSupplyId);
    expect(detailRes.body.items[0].quantity).toBe(20);
  });

  // TC-2.06: Cancelling rules (only ORDERED can be cancelled)
  test('TC-2.06: Procurement officer can cancel an ORDERED order, but cannot cancel DISPATCHED or RECEIVED order', async () => {
    // 1. Create order
    const createRes = await request(app)
      .post('/api/orders')
      .set('Cookie', procureCookie)
      .send({
        supplier_id: testSupplierId,
        expected_date: '2026-12-15',
        items: [{ supply_id: testSupplyId, quantity: 5 }]
      });
    const orderId = createRes.body.order.order_id;

    // 2. Cancel order while ORDERED
    const cancelRes = await request(app)
      .patch(`/api/orders/${orderId}/cancel`)
      .set('Cookie', procureCookie);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.order.status).toBe('CANCELLED');

    // 3. Try to cancel a DISPATCHED order
    // Find seeded dispatched order
    const allOrdersRes = await request(app).get('/api/orders?status=DISPATCHED').set('Cookie', procureCookie);
    const dispatchedOrder = allOrdersRes.body.orders[0];
    expect(dispatchedOrder).toBeDefined();

    const cancelDispatchedRes = await request(app)
      .patch(`/api/orders/${dispatchedOrder.order_id}/cancel`)
      .set('Cookie', procureCookie);
    expect(cancelDispatchedRes.status).toBe(400);
    expect(cancelDispatchedRes.body.error).toMatch(/only orders with 'ordered' status can be cancelled/i);
  });

  // TC-2.07: Supplier can dispatch order with delivery info
  test('TC-2.07: Supplier can update status from ORDERED to DISPATCHED with delivery information', async () => {
    // Create new order for Sahyadri Pharma Distributors (testSupplierId)
    const createRes = await request(app)
      .post('/api/orders')
      .set('Cookie', procureCookie)
      .send({
        supplier_id: testSupplierId,
        expected_date: '2026-11-20',
        items: [{ supply_id: testSupplyId, quantity: 12 }]
      });
    const orderId = createRes.body.order.order_id;

    // Dispatch order as Supplier
    const dispatchRes = await request(app)
      .patch(`/api/orders/${orderId}/dispatch`)
      .set('Cookie', supplierCookie)
      .send({
        dispatch_date: '2026-10-25',
        expected_date: '2026-10-28',
        notes: 'Dispatched via MedExpress Tracking #MX-9988'
      });

    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.order.status).toBe('DISPATCHED');
    expect(dispatchRes.body.order.dispatch_date).toBeDefined();
  });

  // TC-2.08: Supplier cannot mark order as RECEIVED
  test('TC-2.08: Supplier is forbidden from marking order as RECEIVED (403)', async () => {
    // Find an order
    const ordersRes = await request(app).get('/api/orders').set('Cookie', supplierCookie);
    const orderId = ordersRes.body.orders[0].order_id;

    const receiveRes = await request(app)
      .post(`/api/orders/${orderId}/receive`)
      .set('Cookie', supplierCookie);

    expect(receiveRes.status).toBe(403);
    expect(receiveRes.body.error).toMatch(/suppliers cannot mark purchase orders as received/i);
  });

  // TC-2.09: Server enforces supplier data isolation
  test('TC-2.09: A supplier sees ONLY their own orders (enforced on the server)', async () => {
    // The supplier demo user belongs to Sahyadri Pharma Distributors (testSupplierId)
    const ordersRes = await request(app).get('/api/orders').set('Cookie', supplierCookie);
    expect(ordersRes.status).toBe(200);

    // Every returned order must belong to testSupplierId
    for (const order of ordersRes.body.orders) {
      expect(order.supplier_id).toBe(testSupplierId);
    }

    // Try to view details of an order from Bharat MediSupply Pvt. Ltd. (suppliers[1])
    const allOrdersRes = await request(app).get('/api/orders').set('Cookie', procureCookie);
    const otherSupplierOrder = allOrdersRes.body.orders.find(o => o.supplier_id !== testSupplierId);
    expect(otherSupplierOrder).toBeDefined();

    const crossAccessRes = await request(app)
      .get(`/api/orders/${otherSupplierOrder.order_id}`)
      .set('Cookie', supplierCookie);

    expect(crossAccessRes.status).toBe(403);
    expect(crossAccessRes.body.error).toMatch(/access denied/i);
  });

  // TC-2.10: Receiving an order updates stock quantity in database transaction and sets actual_date
  test('TC-2.10: Receiving an order records actual_date and adds quantity to matching medical supply', async () => {
    // 1. Get initial stock of test supply
    const initialSupplyRes = await request(app).get(`/api/supplies/${testSupplyId}`).set('Cookie', procureCookie);
    const initialStock = initialSupplyRes.body.supply.quantity;

    // 2. Create and dispatch order for 35 units
    const addQty = 35;
    const createRes = await request(app)
      .post('/api/orders')
      .set('Cookie', procureCookie)
      .send({
        supplier_id: testSupplierId,
        expected_date: '2026-11-15',
        items: [{ supply_id: testSupplyId, quantity: addQty }]
      });
    const orderId = createRes.body.order.order_id;

    await request(app)
      .patch(`/api/orders/${orderId}/dispatch`)
      .set('Cookie', supplierCookie)
      .send({ notes: 'Dispatched for TC-2.10' });

    // 3. Mark received as Procurement Officer
    const receiveRes = await request(app)
      .post(`/api/orders/${orderId}/receive`)
      .set('Cookie', procureCookie);

    expect(receiveRes.status).toBe(200);
    expect(receiveRes.body.status).toBe('RECEIVED');
    expect(receiveRes.body.actual_date).toBeDefined();

    // 4. Verify inventory stock increased exactly by addQty
    const updatedSupplyRes = await request(app).get(`/api/supplies/${testSupplyId}`).set('Cookie', procureCookie);
    const newStock = updatedSupplyRes.body.supply.quantity;
    expect(newStock).toBe(initialStock + addQty);
  });

  // TC-2.11: An order cannot be received twice
  test('TC-2.11: A received order cannot be received twice', async () => {
    // Find an already received order
    const receivedOrders = await request(app).get('/api/orders?status=RECEIVED').set('Cookie', procureCookie);
    const orderId = receivedOrders.body.orders[0].order_id;

    // Attempt second receive
    const secondReceive = await request(app)
      .post(`/api/orders/${orderId}/receive`)
      .set('Cookie', procureCookie);

    expect(secondReceive.status).toBe(400);
    expect(secondReceive.body.error).toMatch(/cannot receive an order twice/i);
  });

  // TC-2.12: Delayed-order detection
  test('TC-2.12: Orders past expected date and not received show amber Delayed flag', async () => {
    const ordersRes = await request(app).get('/api/orders').set('Cookie', procureCookie);
    const delayedOrder = ordersRes.body.orders.find(o => o.is_delayed === true);

    expect(delayedOrder).toBeDefined();
    expect(new Date(delayedOrder.expected_date).getTime()).toBeLessThan(Date.now());
    expect(delayedOrder.status).not.toBe('RECEIVED');
    expect(delayedOrder.status).not.toBe('CANCELLED');
  });

  // TC-2.13: Role permissions enforcement
  test('TC-2.13: Hospital Department Staff is forbidden from creating orders and managing suppliers (403)', async () => {
    // Staff cannot create orders
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Cookie', staffCookie)
      .send({ supplier_id: testSupplierId, expected_date: '2026-12-31', items: [{ supply_id: testSupplyId, quantity: 1 }] });
    expect(orderRes.status).toBe(403);

    // Staff cannot add suppliers
    const supRes = await request(app)
      .post('/api/suppliers')
      .set('Cookie', staffCookie)
      .send({ name: 'Staff Added Supplier', email: 'staff@test.com' });
    expect(supRes.status).toBe(403);
  });
});
