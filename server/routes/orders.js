const express = require('express');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { evaluateAlerts } = require('../services/alertEngine');

const router = express.Router();

router.use(authenticate);

// Helper to get today's date in YYYY-MM-DD format
function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// GET /api/orders - List purchase orders
router.get('/', async (req, res, next) => {
  try {
    const user = req.session.user;
    const role = user.role;

    // Staff cannot view purchase orders
    if (role === 'Hospital Department Staff') {
      return res.status(403).json({ error: 'Access denied. Department staff cannot view purchase orders.' });
    }

    const { status, supplier_id, from_date, to_date, search } = req.query;

    let query = `
      SELECT po.order_id, po.supplier_id, s.name as supplier_name, s.contact as supplier_contact,
             po.created_by, u.name as created_by_name,
             TO_CHAR(po.order_date, 'YYYY-MM-DD') as order_date,
             po.status,
             (po.dispatch_date IS NOT NULL AND po.dispatch_date > CURRENT_DATE AND po.status = 'DISPATCHED') as is_future_dispatch,
             CASE
               WHEN po.status = 'DISPATCHED' AND po.dispatch_date IS NOT NULL AND po.dispatch_date > CURRENT_DATE THEN 'SCHEDULED_DISPATCH'
               ELSE po.status
             END as display_status,
             TO_CHAR(po.expected_date, 'YYYY-MM-DD') as expected_date,
             TO_CHAR(po.dispatch_date, 'YYYY-MM-DD') as dispatch_date,
             TO_CHAR(po.actual_date, 'YYYY-MM-DD') as actual_date,
             po.notes,
             (po.expected_date < CURRENT_DATE AND po.status NOT IN ('RECEIVED', 'CANCELLED')) as is_delayed,
             COUNT(poi.id) as item_count,
             COALESCE(SUM(poi.quantity), 0) as total_quantity
      FROM purchase_order po
      JOIN supplier s ON po.supplier_id = s.supplier_id
      LEFT JOIN users u ON po.created_by = u.user_id
      LEFT JOIN purchase_order_item poi ON po.order_id = poi.order_id
      WHERE 1=1
    `;
    const params = [];

    // SERVER-ENFORCED SUPPLIER ISOLATION: A supplier sees ONLY their own orders
    if (role === 'Supplier / Vendor') {
      if (!user.supplier_id) {
        return res.json({ orders: [] });
      }
      params.push(user.supplier_id);
      query += ` AND po.supplier_id = $${params.length}`;
    } else if (supplier_id) {
      params.push(parseInt(supplier_id, 10));
      query += ` AND po.supplier_id = $${params.length}`;
    }

    if (status && status !== 'ALL') {
      params.push(status.toUpperCase());
      query += ` AND po.status = $${params.length}`;
    }

    if (from_date) {
      params.push(from_date);
      query += ` AND po.order_date >= $${params.length}::date`;
    }

    if (to_date) {
      params.push(to_date);
      query += ` AND po.order_date <= $${params.length}::date`;
    }

    if (search) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(s.name) LIKE $${params.length} OR CAST(po.order_id AS TEXT) LIKE $${params.length} OR LOWER(COALESCE(po.notes, '')) LIKE $${params.length})`;
    }

    query += `
      GROUP BY po.order_id, s.name, s.contact, u.name
      ORDER BY po.order_date DESC, po.order_id DESC
    `;

    const result = await db.query(query, params);
    return res.json({ orders: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id - View order details with items
router.get('/:id', async (req, res, next) => {
  try {
    const user = req.session.user;
    const role = user.role;

    if (role === 'Hospital Department Staff') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID.' });
    }

    const orderRes = await db.query(`
      SELECT po.order_id, po.supplier_id, s.name as supplier_name, s.contact as supplier_contact,
             s.email as supplier_email, s.address as supplier_address,
             po.created_by, u.name as created_by_name,
             TO_CHAR(po.order_date, 'YYYY-MM-DD') as order_date,
             po.status,
             (po.dispatch_date IS NOT NULL AND po.dispatch_date > CURRENT_DATE AND po.status = 'DISPATCHED') as is_future_dispatch,
             CASE
               WHEN po.status = 'DISPATCHED' AND po.dispatch_date IS NOT NULL AND po.dispatch_date > CURRENT_DATE THEN 'SCHEDULED_DISPATCH'
               ELSE po.status
             END as display_status,
             TO_CHAR(po.expected_date, 'YYYY-MM-DD') as expected_date,
             TO_CHAR(po.dispatch_date, 'YYYY-MM-DD') as dispatch_date,
             TO_CHAR(po.actual_date, 'YYYY-MM-DD') as actual_date,
             po.notes,
             (po.expected_date < CURRENT_DATE AND po.status NOT IN ('RECEIVED', 'CANCELLED')) as is_delayed
      FROM purchase_order po
      JOIN supplier s ON po.supplier_id = s.supplier_id
      LEFT JOIN users u ON po.created_by = u.user_id
      WHERE po.order_id = $1
    `, [orderId]);

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found.' });
    }

    const order = orderRes.rows[0];

    // SERVER-ENFORCED SUPPLIER ISOLATION: A supplier sees ONLY their own orders
    if (role === 'Supplier / Vendor' && order.supplier_id !== user.supplier_id) {
      return res.status(403).json({ error: 'Access denied. You cannot view orders for other suppliers.' });
    }

    // Fetch items with medical supply details
    const itemsRes = await db.query(`
      SELECT poi.id, poi.order_id, poi.supply_id, poi.quantity,
             ms.name, ms.category, ms.batch_no, ms.unit, ms.quantity as current_stock
      FROM purchase_order_item poi
      JOIN medical_supply ms ON poi.supply_id = ms.supply_id
      WHERE poi.order_id = $1
      ORDER BY poi.id ASC
    `, [orderId]);

    return res.json({
      order: order,
      items: itemsRes.rows
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders - Create Purchase Order (Procurement Officer / Hospital Administrator)
router.post('/', requireRole('Procurement Officer', 'Hospital Administrator'), async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { supplier_id, expected_date, notes, items } = req.body;
    const userId = req.session.user.user_id;

    // 1. Validate Supplier
    const supId = parseInt(supplier_id, 10);
    if (!supId || isNaN(supId)) {
      return res.status(400).json({ error: 'A valid supplier must be selected.' });
    }

    const supRes = await client.query('SELECT supplier_id, name, is_active FROM supplier WHERE supplier_id = $1', [supId]);
    if (supRes.rows.length === 0) {
      return res.status(404).json({ error: 'Selected supplier does not exist.' });
    }

    if (!supRes.rows[0].is_active) {
      return res.status(400).json({ error: 'Cannot create purchase order for an inactive supplier.' });
    }

    // 2. Validate Expected Date
    if (!expected_date || !/^\d{4}-\d{2}-\d{2}$/.test(expected_date)) {
      return res.status(400).json({ error: 'Expected delivery date is required and must be in YYYY-MM-DD format.' });
    }

    const todayStr = getTodayString();
    if (expected_date < todayStr) {
      return res.status(400).json({ error: 'Expected delivery date cannot be in the past.' });
    }

    // 3. Validate Items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item must be added to the purchase order.' });
    }

    // Check for duplicate items
    const supplyIdSet = new Set();
    for (const item of items) {
      const sId = parseInt(item.supply_id, 10);
      const qty = Number(item.quantity);

      if (!sId || isNaN(sId)) {
        return res.status(400).json({ error: 'Each item must have a valid medical supply selection.' });
      }

      if (supplyIdSet.has(sId)) {
        return res.status(400).json({ error: 'Order cannot contain duplicate items. Please consolidate quantities.' });
      }
      supplyIdSet.add(sId);

      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ error: 'Quantity must be a positive integer for all items.' });
      }
    }

    // Verify all supply_ids exist
    const supplyIds = Array.from(supplyIdSet);
    const existingSuppliesRes = await client.query(
      'SELECT supply_id FROM medical_supply WHERE supply_id = ANY($1::int[])',
      [supplyIds]
    );

    if (existingSuppliesRes.rows.length !== supplyIds.length) {
      return res.status(400).json({ error: 'One or more selected medical supplies do not exist.' });
    }

    // 4. Insert Purchase Order & Items inside transaction
    await client.query('BEGIN');

    const poRes = await client.query(`
      INSERT INTO purchase_order (supplier_id, created_by, order_date, status, expected_date, notes)
      VALUES ($1, $2, CURRENT_DATE, 'ORDERED', $3, $4)
      RETURNING order_id, supplier_id, created_by, order_date, status, expected_date, notes
    `, [supId, userId, expected_date, notes ? notes.trim() : null]);

    const orderId = poRes.rows[0].order_id;

    for (const item of items) {
      await client.query(`
        INSERT INTO purchase_order_item (order_id, supply_id, quantity)
        VALUES ($1, $2, $3)
      `, [orderId, parseInt(item.supply_id, 10), parseInt(item.quantity, 10)]);
    }

    await client.query('COMMIT');

    // Trigger alert evaluation after PO creation
    evaluateAlerts().catch(e => console.error('[ALERT EVAL ERROR ON ORDER CREATE]', e));

    return res.status(201).json({
      message: 'Purchase order created successfully.',
      order: poRes.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /api/orders/:id/dispatch - Supplier updates status to DISPATCHED and enters delivery info
router.patch('/:id/dispatch', async (req, res, next) => {
  try {
    const user = req.session.user;
    const role = user.role;

    if (role !== 'Supplier / Vendor' && role !== 'Procurement Officer' && role !== 'Hospital Administrator') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID.' });
    }

    const orderRes = await db.query(
      'SELECT order_id, supplier_id, status, notes, expected_date FROM purchase_order WHERE order_id = $1',
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found.' });
    }

    const order = orderRes.rows[0];

    // Supplier can only dispatch their own orders
    if (role === 'Supplier / Vendor' && order.supplier_id !== user.supplier_id) {
      return res.status(403).json({ error: 'Access denied. You cannot dispatch orders of other suppliers.' });
    }

    // Only ORDERED orders can transition to DISPATCHED
    if (order.status !== 'ORDERED') {
      return res.status(400).json({ error: `Cannot dispatch order with current status '${order.status}'. Only 'ORDERED' orders can be dispatched.` });
    }

    const { dispatch_date, expected_date, notes } = req.body;

    const finalDispatchDate = dispatch_date || getTodayString();
    const finalExpectedDate = expected_date || order.expected_date;

    let updatedNotes = order.notes || '';
    if (notes && notes.trim()) {
      updatedNotes = updatedNotes ? `${updatedNotes} | Delivery Info: ${notes.trim()}` : notes.trim();
    }

    const updateRes = await db.query(`
      UPDATE purchase_order
      SET status = 'DISPATCHED',
          dispatch_date = $1,
          expected_date = $2,
          notes = $3
      WHERE order_id = $4
      RETURNING order_id, supplier_id, status, dispatch_date, expected_date, notes
    `, [finalDispatchDate, finalExpectedDate, updatedNotes, orderId]);

    // Trigger alert evaluation after PO dispatch
    evaluateAlerts().catch(e => console.error('[ALERT EVAL ERROR ON DISPATCH]', e));

    const isFuture = finalDispatchDate > getTodayString();
    return res.json({
      message: isFuture
        ? `Purchase order scheduled for dispatch on ${finalDispatchDate}.`
        : 'Purchase order status updated to DISPATCHED with delivery details.',
      order: updateRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/:id/receive - Mark order RECEIVED and increment inventory stock in transaction
router.post('/:id/receive', async (req, res, next) => {
  const user = req.session.user;
  const role = user.role;

  // SUPPLIERS CANNOT MARK RECEIVED (SRS & business rules)
  if (role === 'Supplier / Vendor') {
    return res.status(403).json({ error: 'Access denied. Suppliers cannot mark purchase orders as received.' });
  }

  if (role !== 'Procurement Officer' && role !== 'Hospital Administrator') {
    return res.status(403).json({ error: 'Access denied. Only Procurement Officers can receive stock.' });
  }

  const orderId = parseInt(req.params.id, 10);
  if (isNaN(orderId)) {
    return res.status(400).json({ error: 'Invalid order ID.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch order with row-level lock
    const orderRes = await client.query(
      'SELECT order_id, status, actual_date FROM purchase_order WHERE order_id = $1 FOR UPDATE',
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase order not found.' });
    }

    const order = orderRes.rows[0];

    // Cannot receive twice
    if (order.status === 'RECEIVED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Order has already been received. Cannot receive an order twice.' });
    }

    // Cannot receive cancelled order
    if (order.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cancelled orders cannot be received.' });
    }

    // Update order status to RECEIVED and record actual_date
    await client.query(`
      UPDATE purchase_order
      SET status = 'RECEIVED',
          actual_date = CURRENT_DATE
      WHERE order_id = $1
    `, [orderId]);

    // Fetch items
    const itemsRes = await client.query(
      'SELECT supply_id, quantity FROM purchase_order_item WHERE order_id = $1',
      [orderId]
    );

    // Increment each item's stock in medical_supply
    for (const item of itemsRes.rows) {
      await client.query(`
        UPDATE medical_supply
        SET quantity = quantity + $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE supply_id = $2
      `, [item.quantity, item.supply_id]);
    }

    // Update inventory last_updated
    await client.query('UPDATE inventory SET last_updated = CURRENT_TIMESTAMP');

    await client.query('COMMIT');

    // Trigger alert re-evaluation (resolves DELAYED_DELIVERY and may trigger LOW_STOCK)
    evaluateAlerts().catch(e => console.error('[ALERT EVAL ERROR ON RECEIVE]', e));

    return res.json({
      message: `Purchase order #${orderId} marked as RECEIVED. Stock inventory updated successfully.`,
      order_id: orderId,
      status: 'RECEIVED',
      actual_date: getTodayString()
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /api/orders/:id/cancel - Cancel order (Procurement Officer)
router.patch('/:id/cancel', requireRole('Procurement Officer', 'Hospital Administrator'), async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID.' });
    }

    const orderRes = await db.query(
      'SELECT order_id, status FROM purchase_order WHERE order_id = $1',
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found.' });
    }

    const order = orderRes.rows[0];

    // Business rule: The officer can cancel an order that is still ORDERED
    if (order.status !== 'ORDERED') {
      return res.status(400).json({ 
        error: `Only orders with 'ORDERED' status can be cancelled. Current status is '${order.status}'.` 
      });
    }

    const updateRes = await db.query(`
      UPDATE purchase_order
      SET status = 'CANCELLED'
      WHERE order_id = $1
      RETURNING order_id, status
    `, [orderId]);

    // Trigger alert re-evaluation (resolves DELAYED_DELIVERY for this order)
    evaluateAlerts().catch(e => console.error('[ALERT EVAL ERROR ON CANCEL]', e));

    return res.json({
      message: `Purchase order #${orderId} has been cancelled.`,
      order: updateRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
