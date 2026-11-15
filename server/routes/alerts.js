const express = require('express');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { evaluateAlerts, evaluateAlertsThrottled } = require('../services/alertEngine');

const router = express.Router();

router.use(authenticate);

// Helper to determine allowed alert types for a role
function getAllowedAlertTypes(role) {
  if (role === 'Hospital Administrator') {
    return ['LOW_STOCK', 'NEAR_EXPIRY', 'EXPIRED', 'DELAYED_DELIVERY'];
  }
  if (role === 'Inventory Manager') {
    return ['LOW_STOCK', 'NEAR_EXPIRY', 'EXPIRED'];
  }
  if (role === 'Procurement Officer') {
    return ['DELAYED_DELIVERY'];
  }
  return [];
}

// GET /api/alerts - List active unresolved alerts for the current user's role
router.get('/', async (req, res, next) => {
  try {
    await evaluateAlertsThrottled();
    const role = req.session.user.role;
    const allowedTypes = getAllowedAlertTypes(role);

    if (allowedTypes.length === 0) {
      return res.json({ alerts: [], count: 0 });
    }

    const { type, resolved } = req.query;
    const isResolved = resolved === 'true';

    let query = `
      SELECT 
        a.alert_id,
        a.type,
        a.supply_id,
        a.order_id,
        a.message,
        TO_CHAR(a.created_at, 'YYYY-MM-DD HH24:MI') as created_at,
        a.is_resolved,
        s.name as supply_name,
        s.batch_no as supply_batch_no,
        s.quantity as supply_quantity,
        s.unit as supply_unit,
        s.category as supply_category,
        po.supplier_id as order_supplier_id,
        sup.name as order_supplier_name
      FROM alert a
      LEFT JOIN medical_supply s ON a.supply_id = s.supply_id
      LEFT JOIN purchase_order po ON a.order_id = po.order_id
      LEFT JOIN supplier sup ON po.supplier_id = sup.supplier_id
      WHERE a.type = ANY($1)
    `;
    const params = [allowedTypes];

    if (resolved !== undefined) {
      params.push(isResolved);
      query += ` AND a.is_resolved = $${params.length}`;
    } else {
      // Default: show unresolved only
      query += ` AND a.is_resolved = false`;
    }

    if (type && allowedTypes.includes(type)) {
      params.push(type);
      query += ` AND a.type = $${params.length}`;
    }

    query += ` ORDER BY a.created_at DESC, a.alert_id DESC`;

    const result = await db.query(query, params);

    return res.json({
      alerts: result.rows,
      count: result.rows.length
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/alerts/count - Return active unresolved alert count for the top-bar badge
router.get('/count', async (req, res, next) => {
  try {
    await evaluateAlertsThrottled();
    const role = req.session.user.role;
    const allowedTypes = getAllowedAlertTypes(role);

    if (allowedTypes.length === 0) {
      return res.json({ count: 0 });
    }

    const result = await db.query(
      'SELECT COUNT(*)::int as count FROM alert WHERE is_resolved = false AND type = ANY($1)',
      [allowedTypes]
    );

    return res.json({ count: result.rows[0].count || 0 });
  } catch (err) {
    next(err);
  }
});

// POST /api/alerts/evaluate - Manually run the alert evaluation engine
router.post('/evaluate', async (req, res, next) => {
  try {
    await evaluateAlerts();
    return res.json({ message: 'Alert engine evaluation completed successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
