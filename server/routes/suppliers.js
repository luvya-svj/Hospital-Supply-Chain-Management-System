const express = require('express');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/suppliers - List suppliers with order count
router.get('/', async (req, res, next) => {
  try {
    const { active_only, search } = req.query;

    let query = `
      SELECT s.supplier_id, s.name, s.contact, s.email, s.address, s.is_active,
             COUNT(po.order_id) as total_orders
      FROM supplier s
      LEFT JOIN purchase_order po ON s.supplier_id = po.supplier_id
      WHERE 1=1
    `;
    const params = [];

    if (active_only === 'true') {
      query += ' AND s.is_active = true';
    }

    if (search) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(s.name) LIKE $${params.length} OR LOWER(s.email) LIKE $${params.length} OR LOWER(s.contact) LIKE $${params.length})`;
    }

    query += ' GROUP BY s.supplier_id ORDER BY s.name ASC';

    const result = await db.query(query, params);
    return res.json({ suppliers: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/suppliers/:id - View supplier profile & associated orders
router.get('/:id', async (req, res, next) => {
  try {
    const supplierId = parseInt(req.params.id, 10);
    if (isNaN(supplierId)) {
      return res.status(400).json({ error: 'Invalid supplier ID.' });
    }

    const supRes = await db.query(
      'SELECT supplier_id, name, contact, email, address, is_active FROM supplier WHERE supplier_id = $1',
      [supplierId]
    );

    if (supRes.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }

    // Fetch this supplier's purchase orders
    const ordersRes = await db.query(`
      SELECT po.order_id, po.status, TO_CHAR(po.order_date, 'YYYY-MM-DD') as order_date,
             TO_CHAR(po.expected_date, 'YYYY-MM-DD') as expected_date,
             TO_CHAR(po.dispatch_date, 'YYYY-MM-DD') as dispatch_date,
             TO_CHAR(po.actual_date, 'YYYY-MM-DD') as actual_date,
             po.notes,
             u.name as created_by_name,
             COUNT(poi.id) as item_count,
             COALESCE(SUM(poi.quantity), 0) as total_quantity
      FROM purchase_order po
      LEFT JOIN users u ON po.created_by = u.user_id
      LEFT JOIN purchase_order_item poi ON po.order_id = poi.order_id
      WHERE po.supplier_id = $1
      GROUP BY po.order_id, u.name
      ORDER BY po.order_date DESC, po.order_id DESC
    `, [supplierId]);

    return res.json({
      supplier: supRes.rows[0],
      orders: ordersRes.rows
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/suppliers - Add supplier (Procurement Officer or Administrator)
router.post('/', requireRole('Procurement Officer', 'Hospital Administrator'), async (req, res, next) => {
  try {
    const { name, contact, email, address } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Supplier name is required.' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Supplier email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email format provided.' });
    }

    const cleanName = name.trim();
    const cleanContact = contact ? contact.trim() : null;
    const cleanAddress = address ? address.trim() : null;

    const result = await db.query(`
      INSERT INTO supplier (name, contact, email, address, is_active)
      VALUES ($1, $2, $3, $4, true)
      RETURNING supplier_id, name, contact, email, address, is_active
    `, [cleanName, cleanContact, cleanEmail, cleanAddress]);

    return res.status(201).json({
      message: 'Supplier registered successfully.',
      supplier: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/suppliers/:id/status - Activate or Deactivate supplier
router.patch('/:id/status', requireRole('Procurement Officer', 'Hospital Administrator'), async (req, res, next) => {
  try {
    const supplierId = parseInt(req.params.id, 10);
    const { is_active } = req.body;

    if (isNaN(supplierId)) {
      return res.status(400).json({ error: 'Invalid supplier ID.' });
    }

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'Field is_active must be a boolean.' });
    }

    const checkRes = await db.query('SELECT supplier_id, name FROM supplier WHERE supplier_id = $1', [supplierId]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }

    const updateRes = await db.query(`
      UPDATE supplier 
      SET is_active = $1 
      WHERE supplier_id = $2 
      RETURNING supplier_id, name, is_active
    `, [is_active, supplierId]);

    const statusText = is_active ? 'activated' : 'deactivated';
    return res.json({
      message: `Supplier '${updateRes.rows[0].name}' has been ${statusText}.`,
      supplier: updateRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
