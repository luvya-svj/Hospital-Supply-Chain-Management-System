const express = require('express');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { isExpired, isNearExpiry, isLowStock, computeStockStatus } = require('../utils/stockUtils');
const { evaluateAlerts } = require('../services/alertEngine');

const router = express.Router();

router.use(authenticate);

// Helper to get near_expiry_days setting
async function getNearExpiryDays() {
  const res = await db.query('SELECT value FROM system_setting WHERE key = $1', ['near_expiry_days']);
  return res.rows.length > 0 ? parseInt(res.rows[0].value, 10) : 30;
}

// GET /api/supplies/expiry - Expiry monitoring: near-expiry and expired items
// Inventory Manager only
router.get('/expiry', requireRole('Inventory Manager', 'Hospital Administrator'), async (req, res, next) => {
  try {
    const nearExpiryDays = await getNearExpiryDays();

    // Auto-update expired supplies before reporting
    await db.query(`
      UPDATE medical_supply
      SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
      WHERE expiry_date < CURRENT_DATE AND status = 'AVAILABLE'
    `);

    // Near expiry: expiry_date between today and today + N days, not DISPOSED, quantity > 0
    const nearExpiryRes = await db.query(`
      SELECT s.supply_id, s.name, s.category, s.batch_no, s.quantity, s.unit,
             s.min_stock_level, s.near_expiry_days, TO_CHAR(s.expiry_date, 'YYYY-MM-DD') as expiry_date,
             s.status, sup.name as supplier_name,
             (s.expiry_date - CURRENT_DATE) as days_remaining
      FROM medical_supply s
      LEFT JOIN supplier sup ON s.supplier_id = sup.supplier_id
      WHERE s.status != 'DISPOSED'
        AND s.quantity > 0
        AND s.expiry_date >= CURRENT_DATE
        AND s.expiry_date <= (CURRENT_DATE + (COALESCE(s.near_expiry_days, $1) || ' days')::interval)
      ORDER BY s.expiry_date ASC
    `, [nearExpiryDays]);

    // Expired: expiry_date < today, not DISPOSED, quantity > 0
    const expiredRes = await db.query(`
      SELECT s.supply_id, s.name, s.category, s.batch_no, s.quantity, s.unit,
             s.min_stock_level, TO_CHAR(s.expiry_date, 'YYYY-MM-DD') as expiry_date,
             s.status, sup.name as supplier_name,
             (CURRENT_DATE - s.expiry_date) as days_overdue
      FROM medical_supply s
      LEFT JOIN supplier sup ON s.supplier_id = sup.supplier_id
      WHERE s.expiry_date < CURRENT_DATE
        AND s.status != 'DISPOSED'
        AND s.quantity > 0
      ORDER BY s.expiry_date ASC
    `);

    return res.json({
      near_expiry_days: nearExpiryDays,
      near_expiry: nearExpiryRes.rows.map(r => ({ ...r, days_remaining: parseInt(r.days_remaining, 10) })),
      expired: expiredRes.rows.map(r => ({ ...r, days_overdue: parseInt(r.days_overdue, 10) }))
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/supplies/categories
router.get('/categories', async (req, res, next) => {
  try {
    const result = await db.query('SELECT DISTINCT category FROM medical_supply ORDER BY category ASC');
    return res.json({ categories: result.rows.map(r => r.category) });
  } catch (err) {
    next(err);
  }
});

// GET /api/supplies - List and monitor stock levels
router.get('/', async (req, res, next) => {
  try {
    const { search, category, status, low_stock_only, sort_by, sort_order } = req.query;
    const nearExpiryDays = await getNearExpiryDays();

    // First auto-update status to EXPIRED for any items whose expiry_date has passed and status is still AVAILABLE
    await db.query(`
      UPDATE medical_supply 
      SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP 
      WHERE expiry_date < CURRENT_DATE AND status = 'AVAILABLE'
    `);

    let query = `
      SELECT s.supply_id, s.inventory_id, s.name, s.category, s.batch_no, s.quantity, s.unit,
             s.min_stock_level, s.near_expiry_days, TO_CHAR(s.expiry_date, 'YYYY-MM-DD') as expiry_date, s.supplier_id,
             s.status, s.updated_at, sup.name as supplier_name
      FROM medical_supply s
      LEFT JOIN supplier sup ON s.supplier_id = sup.supplier_id
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      params.push(category);
      query += ` AND s.category = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND s.status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(s.name) LIKE $${params.length} OR LOWER(s.batch_no) LIKE $${params.length} OR LOWER(s.category) LIKE $${params.length})`;
    }

    // Dynamic sort
    const validSortCols = {
      name: 's.name',
      quantity: 's.quantity',
      expiry_date: 's.expiry_date',
      min_stock_level: 's.min_stock_level',
      category: 's.category'
    };
    const orderCol = validSortCols[sort_by] || 's.name';
    const direction = sort_order && sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    query += ` ORDER BY ${orderCol} ${direction}, s.supply_id ASC`;

    const result = await db.query(query, params);

    // Enrich with computed status and flags
    let enriched = result.rows.map(item => {
      const itemThreshold = item.near_expiry_days != null ? parseInt(item.near_expiry_days, 10) : nearExpiryDays;
      const computed = computeStockStatus(item, itemThreshold);
      const nearExp = isNearExpiry(item.expiry_date, itemThreshold);
      const isExp = isExpired(item.expiry_date) || item.status === 'EXPIRED';
      const isLow = isLowStock(item.quantity, item.min_stock_level, item.status);

      return {
        ...item,
        computed_status: computed,
        is_low_stock: isLow,
        is_near_expiry: nearExp,
        is_expired: isExp
      };
    });

    // Handle "low_stock_only" filter
    if (low_stock_only === 'true') {
      enriched = enriched.filter(item => item.is_low_stock);
    }

    return res.json({
      supplies: enriched,
      total: enriched.length
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/supplies/:id - View single supply details
router.get('/:id', async (req, res, next) => {
  try {
    const supplyId = parseInt(req.params.id, 10);
    const nearExpiryDays = await getNearExpiryDays();

    // Auto-update status to EXPIRED for this supply if its expiry date has passed and status is still AVAILABLE
    await db.query(`
      UPDATE medical_supply 
      SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP 
      WHERE expiry_date < CURRENT_DATE AND status = 'AVAILABLE' AND supply_id = $1
    `, [supplyId]);

    const query = `
      SELECT s.supply_id, s.inventory_id, s.name, s.category, s.batch_no, s.quantity, s.unit,
             s.min_stock_level, s.near_expiry_days, TO_CHAR(s.expiry_date, 'YYYY-MM-DD') as expiry_date, s.supplier_id,
             s.status, s.updated_at, sup.name as supplier_name, sup.contact as supplier_contact
      FROM medical_supply s
      LEFT JOIN supplier sup ON s.supplier_id = sup.supplier_id
      WHERE s.supply_id = $1
    `;
    const result = await db.query(query, [supplyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medical supply not found.' });
    }

    const item = result.rows[0];
    const itemThreshold = item.near_expiry_days != null ? parseInt(item.near_expiry_days, 10) : nearExpiryDays;
    const computed = computeStockStatus(item, itemThreshold);

    return res.json({
      supply: {
        ...item,
        computed_status: computed,
        is_low_stock: isLowStock(item.quantity, item.min_stock_level, item.status),
        is_near_expiry: isNearExpiry(item.expiry_date, itemThreshold),
        is_expired: isExpired(item.expiry_date) || item.status === 'EXPIRED'
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/supplies - Add new supply (Inventory Manager only)
router.post('/', requireRole('Inventory Manager'), async (req, res, next) => {
  try {
    const { name, category, batch_no, quantity, unit, min_stock_level, near_expiry_days, expiry_date, supplier_id } = req.body;

    if (!name || !category || !batch_no || quantity === undefined || !unit || min_stock_level === undefined || !expiry_date) {
      return res.status(400).json({ error: 'All supply details (name, category, batch no, quantity, unit, min stock level, expiry date) are required.' });
    }

    const qty = parseInt(quantity, 10);
    const minStock = parseInt(min_stock_level, 10);
    const nearExpDays = (near_expiry_days !== undefined && near_expiry_days !== '' && near_expiry_days !== null)
      ? parseInt(near_expiry_days, 10)
      : null;

    if (isNaN(qty) || qty < 0) {
      return res.status(400).json({ error: 'Quantity must be a non-negative integer.' });
    }

    if (isNaN(minStock) || minStock < 0) {
      return res.status(400).json({ error: 'Minimum stock level must be a non-negative integer.' });
    }

    if (nearExpDays !== null && (isNaN(nearExpDays) || nearExpDays <= 0)) {
      return res.status(400).json({ error: 'Near expiry threshold must be a positive integer.' });
    }

    const expDate = new Date(expiry_date);
    if (isNaN(expDate.getTime())) {
      return res.status(400).json({ error: 'Expiry date must be a valid date (YYYY-MM-DD).' });
    }

    // Duplicate check on (name, batch_no)
    const duplicate = await db.query(
      'SELECT supply_id FROM medical_supply WHERE LOWER(name) = $1 AND LOWER(batch_no) = $2',
      [name.trim().toLowerCase(), batch_no.trim().toLowerCase()]
    );

    if (duplicate.rows.length > 0) {
      return res.status(400).json({ error: `A medical supply with name "${name}" and batch number "${batch_no}" already exists.` });
    }

    // Determine default inventory ID
    const invRes = await db.query('SELECT inventory_id FROM inventory LIMIT 1');
    const inventoryId = invRes.rows[0]?.inventory_id || 1;

    const initialStatus = isExpired(expiry_date) ? 'EXPIRED' : 'AVAILABLE';

    const insertRes = await db.query(`
      INSERT INTO medical_supply 
        (inventory_id, name, category, batch_no, quantity, unit, min_stock_level, near_expiry_days, expiry_date, supplier_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING supply_id, name, category, batch_no, quantity, unit, min_stock_level, near_expiry_days,
                TO_CHAR(expiry_date, 'YYYY-MM-DD') as expiry_date, status
    `, [
      inventoryId,
      name.trim(),
      category.trim(),
      batch_no.trim(),
      qty,
      unit.trim(),
      minStock,
      nearExpDays,
      expiry_date,
      supplier_id ? parseInt(supplier_id, 10) : null,
      initialStatus
    ]);

    // Update inventory last_updated
    await db.query('UPDATE inventory SET last_updated = CURRENT_TIMESTAMP WHERE inventory_id = $1', [inventoryId]);

    // Trigger alert evaluation after new stock is added
    evaluateAlerts().catch(e => console.error('[ALERT EVAL ERROR ON ADD]', e));

    return res.status(201).json({
      message: 'Medical supply added successfully.',
      supply: insertRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/supplies/:id - Update supply (Inventory Manager only)
router.put('/:id', requireRole('Inventory Manager'), async (req, res, next) => {
  try {
    const supplyId = parseInt(req.params.id, 10);
    const { name, category, batch_no, quantity, unit, min_stock_level, near_expiry_days, expiry_date, supplier_id } = req.body;

    if (!name || !category || !batch_no || quantity === undefined || !unit || min_stock_level === undefined || !expiry_date) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const qty = parseInt(quantity, 10);
    const minStock = parseInt(min_stock_level, 10);
    const nearExpDays = (near_expiry_days !== undefined && near_expiry_days !== '' && near_expiry_days !== null)
      ? parseInt(near_expiry_days, 10)
      : null;

    if (isNaN(qty) || qty < 0) {
      return res.status(400).json({ error: 'Quantity must be a non-negative integer.' });
    }

    if (isNaN(minStock) || minStock < 0) {
      return res.status(400).json({ error: 'Minimum stock level must be a non-negative integer.' });
    }

    if (nearExpDays !== null && (isNaN(nearExpDays) || nearExpDays <= 0)) {
      return res.status(400).json({ error: 'Near expiry threshold must be a positive integer.' });
    }

    const expDate = new Date(expiry_date);
    if (isNaN(expDate.getTime())) {
      return res.status(400).json({ error: 'Expiry date must be a valid date.' });
    }

    // Duplicate check on (name, batch_no) excluding self
    const duplicate = await db.query(
      'SELECT supply_id FROM medical_supply WHERE LOWER(name) = $1 AND LOWER(batch_no) = $2 AND supply_id != $3',
      [name.trim().toLowerCase(), batch_no.trim().toLowerCase(), supplyId]
    );

    if (duplicate.rows.length > 0) {
      return res.status(400).json({ error: `Another supply with name "${name}" and batch number "${batch_no}" already exists.` });
    }

    const currentStatusRes = await db.query('SELECT status FROM medical_supply WHERE supply_id = $1', [supplyId]);
    if (currentStatusRes.rows.length === 0) {
      return res.status(404).json({ error: 'Medical supply not found.' });
    }

    let status = currentStatusRes.rows[0].status;
    if (status !== 'DISPOSED') {
      status = isExpired(expiry_date) ? 'EXPIRED' : 'AVAILABLE';
    }

    const updateRes = await db.query(`
      UPDATE medical_supply 
      SET name = $1, category = $2, batch_no = $3, quantity = $4, unit = $5,
          min_stock_level = $6, near_expiry_days = $7, expiry_date = $8, supplier_id = $9, status = $10, updated_at = CURRENT_TIMESTAMP
      WHERE supply_id = $11
      RETURNING supply_id, name, category, batch_no, quantity, unit, min_stock_level, near_expiry_days,
                TO_CHAR(expiry_date, 'YYYY-MM-DD') as expiry_date, status
    `, [
      name.trim(),
      category.trim(),
      batch_no.trim(),
      qty,
      unit.trim(),
      minStock,
      nearExpDays,
      expiry_date,
      supplier_id ? parseInt(supplier_id, 10) : null,
      status,
      supplyId
    ]);

    // Trigger alert re-evaluation after update
    evaluateAlerts().catch(e => console.error('[ALERT EVAL ERROR ON UPDATE]', e));

    return res.json({
      message: 'Medical supply updated successfully.',
      supply: updateRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/supplies/:id - Delete supply (Inventory Manager only)
router.delete('/:id', requireRole('Inventory Manager'), async (req, res, next) => {
  try {
    const supplyId = parseInt(req.params.id, 10);

    // Check if supply has existing purchase order items or requests
    const checkRequests = await db.query('SELECT request_id FROM supply_request WHERE supply_id = $1 LIMIT 1', [supplyId]);
    if (checkRequests.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete supply: it has associated department supply requests.' });
    }

    const checkPO = await db.query('SELECT id FROM purchase_order_item WHERE supply_id = $1 LIMIT 1', [supplyId]);
    if (checkPO.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete supply: it is referenced in purchase orders.' });
    }

    const deleteRes = await db.query('DELETE FROM medical_supply WHERE supply_id = $1 RETURNING supply_id, name', [supplyId]);
    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Medical supply not found.' });
    }

    // Trigger alert evaluation after supply deletion
    evaluateAlerts().catch(e => console.error('[ALERT EVAL ERROR ON DELETE]', e));

    return res.json({
      message: `Supply "${deleteRes.rows[0].name}" deleted successfully.`
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
