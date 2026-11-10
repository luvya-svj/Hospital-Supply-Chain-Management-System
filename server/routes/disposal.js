const express = require('express');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { evaluateAlerts } = require('../services/alertEngine');

const router = express.Router();

router.use(authenticate);

// GET /api/disposals - List disposal history with search and date filters
router.get('/', requireRole('Inventory Manager', 'Hospital Administrator'), async (req, res, next) => {
  try {
    const { search, start_date, end_date } = req.query;

    let query = `
      SELECT 
        d.disposal_id,
        d.supply_id,
        d.quantity,
        TO_CHAR(d.disposal_date, 'YYYY-MM-DD') as disposal_date,
        d.reason,
        d.recorded_by,
        u.name as recorded_by_name,
        s.name as supply_name,
        s.batch_no,
        s.unit,
        s.category,
        s.status as current_supply_status,
        s.quantity as remaining_quantity
      FROM disposal_record d
      JOIN medical_supply s ON d.supply_id = s.supply_id
      JOIN users u ON d.recorded_by = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      params.push(start_date);
      query += ` AND d.disposal_date >= $${params.length}`;
    }

    if (end_date) {
      params.push(end_date);
      query += ` AND d.disposal_date <= $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (
        LOWER(s.name) LIKE $${params.length} 
        OR LOWER(s.batch_no) LIKE $${params.length} 
        OR LOWER(d.reason) LIKE $${params.length}
        OR LOWER(u.name) LIKE $${params.length}
      )`;
    }

    query += ` ORDER BY d.disposal_date DESC, d.disposal_id DESC`;

    const result = await db.query(query, params);

    return res.json({
      disposals: result.rows,
      total: result.rows.length
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/disposals - Record a new supply disposal
router.post('/', requireRole('Inventory Manager'), async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { supply_id, quantity, disposal_date, reason } = req.body;

    if (!supply_id || quantity === undefined || !reason || !reason.trim()) {
      return res.status(400).json({ error: 'Supply ID, quantity, and reason for disposal are required.' });
    }

    const qtyToDispose = parseInt(quantity, 10);
    if (isNaN(qtyToDispose) || qtyToDispose <= 0) {
      return res.status(400).json({ error: 'Disposal quantity must be a positive integer greater than 0.' });
    }

    const supplyId = parseInt(supply_id, 10);
    if (isNaN(supplyId)) {
      return res.status(400).json({ error: 'Invalid medical supply ID.' });
    }

    const dispDate = disposal_date ? new Date(disposal_date) : new Date();
    if (isNaN(dispDate.getTime())) {
      return res.status(400).json({ error: 'Invalid disposal date format.' });
    }
    const formattedDate = dispDate.toISOString().split('T')[0];

    await client.query('BEGIN');

    // Lock and inspect the medical supply record
    const supplyRes = await client.query(`
      SELECT supply_id, name, batch_no, quantity, unit, status, inventory_id
      FROM medical_supply
      WHERE supply_id = $1
      FOR UPDATE
    `, [supplyId]);

    if (supplyRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Medical supply not found.' });
    }

    const supply = supplyRes.rows[0];

    if (supply.status === 'DISPOSED' || supply.quantity === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Medical supply "${supply.name}" (Batch ${supply.batch_no}) is already fully disposed.` });
    }

    if (qtyToDispose > supply.quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Disposal quantity (${qtyToDispose} ${supply.unit}) cannot exceed available stock (${supply.quantity} ${supply.unit}).`
      });
    }

    // Insert disposal record
    const insertRes = await client.query(`
      INSERT INTO disposal_record (supply_id, quantity, disposal_date, reason, recorded_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING disposal_id, supply_id, quantity, TO_CHAR(disposal_date, 'YYYY-MM-DD') as disposal_date, reason, recorded_by
    `, [supplyId, qtyToDispose, formattedDate, reason.trim(), req.session.user.user_id]);

    const remainingQty = supply.quantity - qtyToDispose;
    const newStatus = remainingQty === 0 ? 'DISPOSED' : supply.status;

    // Update supply quantity and status
    await client.query(`
      UPDATE medical_supply
      SET quantity = $1, status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE supply_id = $3
    `, [remainingQty, newStatus, supplyId]);

    // Update inventory store timestamp
    await client.query(`
      UPDATE inventory
      SET last_updated = CURRENT_TIMESTAMP
      WHERE inventory_id = $1
    `, [supply.inventory_id]);

    await client.query('COMMIT');

    // Trigger alert engine evaluation to auto-resolve or update alerts
    evaluateAlerts().catch(e => console.error('[ALERT EVAL ERROR ON DISPOSAL]', e));

    return res.status(201).json({
      message: `Successfully disposed ${qtyToDispose} ${supply.unit} of "${supply.name}".`,
      disposal: insertRes.rows[0],
      supply: {
        supply_id: supplyId,
        remaining_quantity: remainingQty,
        status: newStatus
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
