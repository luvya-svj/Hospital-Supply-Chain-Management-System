const express = require('express');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { isExpired } = require('../utils/stockUtils');
const { evaluateAlerts } = require('../services/alertEngine');

const router = express.Router();

router.use(authenticate);

// GET /api/requests/my - Department staff view their own requests
router.get('/my', requireRole('Hospital Department Staff'), async (req, res, next) => {
  try {
    const userId = req.session.user.user_id;
    const query = `
      SELECT r.request_id, r.supply_id, r.department, r.quantity, r.status,
             TO_CHAR(r.request_date, 'YYYY-MM-DD HH24:MI') as request_date,
             TO_CHAR(r.decided_at, 'YYYY-MM-DD HH24:MI') as decided_at,
             s.name as supply_name, s.category, s.batch_no, s.unit,
             u.name as decided_by_name
      FROM supply_request r
      JOIN medical_supply s ON r.supply_id = s.supply_id
      LEFT JOIN users u ON r.decided_by = u.user_id
      WHERE r.requested_by = $1
      ORDER BY r.request_id DESC
    `;
    const result = await db.query(query, [userId]);
    return res.json({ requests: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/requests - Inventory Manager view all requests
router.get('/', requireRole('Inventory Manager', 'Hospital Administrator'), async (req, res, next) => {
  try {
    const { status } = req.query;

    // Auto-update expired items status
    await db.query(`
      UPDATE medical_supply 
      SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP 
      WHERE expiry_date < CURRENT_DATE AND status = 'AVAILABLE'
    `);

    let query = `
      SELECT r.request_id, r.supply_id, r.department, r.quantity, r.status,
             TO_CHAR(r.request_date, 'YYYY-MM-DD HH24:MI') as request_date,
             TO_CHAR(r.decided_at, 'YYYY-MM-DD HH24:MI') as decided_at,
             s.name as supply_name, s.category, s.batch_no, s.quantity as available_quantity, s.unit,
             TO_CHAR(s.expiry_date, 'YYYY-MM-DD') as expiry_date, s.status as supply_status,
             req_user.name as requested_by_name, req_user.email as requested_by_email,
             dec_user.name as decided_by_name
      FROM supply_request r
      JOIN medical_supply s ON r.supply_id = s.supply_id
      JOIN users req_user ON r.requested_by = req_user.user_id
      LEFT JOIN users dec_user ON r.decided_by = dec_user.user_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status.toUpperCase());
      query += ` AND r.status = $${params.length}`;
    }

    query += ' ORDER BY r.request_id DESC';

    const result = await db.query(query, params);
    return res.json({ requests: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/requests - Create a supply request (Hospital Department Staff)
router.post('/', requireRole('Hospital Department Staff'), async (req, res, next) => {
  try {
    const { supply_id, department, quantity } = req.body;
    const requestedBy = req.session.user.user_id;

    if (!supply_id || !quantity) {
      return res.status(400).json({ error: 'Supply and quantity are required.' });
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive integer greater than 0.' });
    }

    const dept = department?.trim() || req.session.user.department;
    if (!dept) {
      return res.status(400).json({ error: 'Department is required for supply requests.' });
    }

    // Auto-update expired supply status if past expiry date
    await db.query(`
      UPDATE medical_supply 
      SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP 
      WHERE expiry_date < CURRENT_DATE AND status = 'AVAILABLE' AND supply_id = $1
    `, [parseInt(supply_id, 10)]);

    // Check supply eligibility
    const supplyRes = await db.query(
      'SELECT supply_id, name, quantity, expiry_date, status FROM medical_supply WHERE supply_id = $1',
      [parseInt(supply_id, 10)]
    );

    if (supplyRes.rows.length === 0) {
      return res.status(404).json({ error: 'Requested medical supply not found.' });
    }

    const supply = supplyRes.rows[0];

    // Business rule: Expired items CANNOT be requested
    if (supply.status === 'EXPIRED' || isExpired(supply.expiry_date)) {
      return res.status(400).json({ error: `Cannot request expired supply "${supply.name}".` });
    }

    // Business rule: Out of stock or requesting more than available stock
    if (supply.quantity <= 0) {
      return res.status(400).json({ error: `Supply "${supply.name}" is currently out of stock.` });
    }

    if (qty > supply.quantity) {
      return res.status(400).json({ 
        error: `Requested quantity (${qty}) exceeds currently available stock (${supply.quantity}).` 
      });
    }

    const insertRes = await db.query(`
      INSERT INTO supply_request (supply_id, requested_by, department, quantity, status, request_date)
      VALUES ($1, $2, $3, $4, 'PENDING', CURRENT_TIMESTAMP)
      RETURNING request_id, supply_id, department, quantity, status, TO_CHAR(request_date, 'YYYY-MM-DD HH24:MI') as request_date
    `, [supply.supply_id, requestedBy, dept, qty]);

    return res.status(201).json({
      message: 'Supply request submitted successfully.',
      request: insertRes.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/requests/:id/decide - Approve or Reject request (Inventory Manager)
router.post('/:id/decide', requireRole('Inventory Manager'), async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const requestId = parseInt(req.params.id, 10);
    const { action } = req.body; // 'APPROVE' or 'REJECT'
    const decidedBy = req.session.user.user_id;

    if (!action || !['APPROVE', 'REJECT'].includes(action.toUpperCase())) {
      return res.status(400).json({ error: 'Action must be either APPROVE or REJECT.' });
    }

    await client.query('BEGIN');

    // Fetch request with supply lock
    const reqRes = await client.query(`
      SELECT r.request_id, r.supply_id, r.quantity, r.status,
             s.name as supply_name, s.quantity as stock_quantity, s.expiry_date, s.status as supply_status
      FROM supply_request r
      JOIN medical_supply s ON r.supply_id = s.supply_id
      WHERE r.request_id = $1
      FOR UPDATE OF s
    `, [requestId]);

    if (reqRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Supply request not found.' });
    }

    const requestItem = reqRes.rows[0];

    if (requestItem.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Request has already been ${requestItem.status.toLowerCase()}.` });
    }

    if (action.toUpperCase() === 'APPROVE') {
      // Business rules: reject approval if expired or insufficient stock
      if (requestItem.supply_status === 'EXPIRED' || isExpired(requestItem.expiry_date)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cannot approve request: supply is expired.' });
      }

      if (requestItem.stock_quantity < requestItem.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Cannot approve request: available stock (${requestItem.stock_quantity}) is insufficient for requested quantity (${requestItem.quantity}).` 
        });
      }

      // Deduct stock
      await client.query(`
        UPDATE medical_supply
        SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP
        WHERE supply_id = $2
      `, [requestItem.quantity, requestItem.supply_id]);

      // Update request status
      const updatedReq = await client.query(`
        UPDATE supply_request
        SET status = 'APPROVED', decided_by = $1, decided_at = CURRENT_TIMESTAMP
        WHERE request_id = $2
        RETURNING request_id, status, TO_CHAR(decided_at, 'YYYY-MM-DD HH24:MI') as decided_at
      `, [decidedBy, requestId]);

      await client.query('COMMIT');

      // Trigger alert re-evaluation after stock deduction
      evaluateAlerts().catch(e => console.error('[ALERT EVAL ERROR ON REQUEST APPROVE]', e));

      return res.json({
        message: `Supply request for "${requestItem.supply_name}" approved successfully. Stock deducted by ${requestItem.quantity}.`,
        request: updatedReq.rows[0]
      });
    } else {
      // REJECT
      const updatedReq = await client.query(`
        UPDATE supply_request
        SET status = 'REJECTED', decided_by = $1, decided_at = CURRENT_TIMESTAMP
        WHERE request_id = $2
        RETURNING request_id, status, TO_CHAR(decided_at, 'YYYY-MM-DD HH24:MI') as decided_at
      `, [decidedBy, requestId]);

      await client.query('COMMIT');

      return res.json({
        message: `Supply request for "${requestItem.supply_name}" was rejected.`,
        request: updatedReq.rows[0]
      });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
