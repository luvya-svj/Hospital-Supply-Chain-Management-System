const express = require('express');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { evaluateAlerts } = require('../services/alertEngine');

const router = express.Router();

router.use(authenticate, requireRole('Hospital Administrator'));

// GET /api/settings
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query('SELECT key, value FROM system_setting ORDER BY key ASC');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });

    return res.json({ settings });
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings
router.put('/', async (req, res, next) => {
  try {
    const { near_expiry_days, default_min_stock_level } = req.body;

    if (near_expiry_days !== undefined) {
      const days = parseInt(near_expiry_days, 10);
      if (isNaN(days) || days <= 0 || days > 365) {
        return res.status(400).json({ error: 'Near expiry days must be a positive integer between 1 and 365.' });
      }
      await db.query(
        'INSERT INTO system_setting (key, value) VALUES (\'near_expiry_days\', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        [days.toString()]
      );
    }

    if (default_min_stock_level !== undefined) {
      const minStock = parseInt(default_min_stock_level, 10);
      if (isNaN(minStock) || minStock < 0 || minStock > 10000) {
        return res.status(400).json({ error: 'Default minimum stock level must be a non-negative integer.' });
      }
      await db.query(
        'INSERT INTO system_setting (key, value) VALUES (\'default_min_stock_level\', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        [minStock.toString()]
      );
    }

    const updated = await db.query('SELECT key, value FROM system_setting ORDER BY key ASC');
    const settings = {};
    updated.rows.forEach(row => {
      settings[row.key] = row.value;
    });

    // Trigger alert re-evaluation since near_expiry_days may have changed
    await evaluateAlerts().catch(e => console.error('[ALERT EVAL ERROR ON SETTINGS CHANGE]', e));

    return res.json({
      message: 'System settings updated successfully.',
      settings
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/product-thresholds - Get all supplies with custom shelf life & min stock thresholds
router.get('/product-thresholds', async (req, res, next) => {
  try {
    const defaultDaysRes = await db.query("SELECT value FROM system_setting WHERE key = 'near_expiry_days'");
    const defaultMinRes = await db.query("SELECT value FROM system_setting WHERE key = 'default_min_stock_level'");
    const defaultNearDays = defaultDaysRes.rows[0]?.value ? parseInt(defaultDaysRes.rows[0].value, 10) : 30;
    const defaultMinStock = defaultMinRes.rows[0]?.value ? parseInt(defaultMinRes.rows[0].value, 10) : 20;

    const result = await db.query(`
      SELECT s.supply_id, s.name, s.batch_no, s.category, s.quantity, s.unit,
             s.min_stock_level, s.near_expiry_days, TO_CHAR(s.expiry_date, 'YYYY-MM-DD') as expiry_date,
             s.status
      FROM medical_supply s
      ORDER BY s.category ASC, s.name ASC, s.batch_no ASC
    `);

    return res.json({
      default_near_expiry_days: defaultNearDays,
      default_min_stock_level: defaultMinStock,
      supplies: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/product-thresholds/:id - Update custom shelf life & min stock threshold for a product
router.put('/product-thresholds/:id', async (req, res, next) => {
  try {
    const supplyId = parseInt(req.params.id, 10);
    const { min_stock_level, near_expiry_days } = req.body;

    const minStock = parseInt(min_stock_level, 10);
    if (isNaN(minStock) || minStock < 0) {
      return res.status(400).json({ error: 'Minimum stock level must be a non-negative integer.' });
    }

    const nearExpDays = (near_expiry_days !== undefined && near_expiry_days !== '' && near_expiry_days !== null)
      ? parseInt(near_expiry_days, 10)
      : null;

    if (nearExpDays !== null && (isNaN(nearExpDays) || nearExpDays <= 0 || nearExpDays > 365)) {
      return res.status(400).json({ error: 'Near expiry threshold must be a positive integer between 1 and 365 days.' });
    }

    const result = await db.query(`
      UPDATE medical_supply
      SET min_stock_level = $1, near_expiry_days = $2, updated_at = CURRENT_TIMESTAMP
      WHERE supply_id = $3
      RETURNING supply_id, name, batch_no, min_stock_level, near_expiry_days
    `, [minStock, nearExpDays, supplyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medical supply not found.' });
    }

    await evaluateAlerts().catch(e => console.error('[ALERT EVAL ERROR ON THRESHOLD CHANGE]', e));

    return res.json({
      message: `Thresholds updated successfully for "${result.rows[0].name}".`,
      supply: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
