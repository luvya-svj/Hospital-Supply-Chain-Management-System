const express = require('express');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { isExpired, isNearExpiry, isLowStock, computeStockStatus } = require('../utils/stockUtils');

const router = express.Router();

// Only Hospital Administrator can view reports (SRS 4.1.4, Section 3 of PROJECT_BRIEF)
router.use(authenticate, requireRole('Hospital Administrator'));

// GET /api/reports/inventory - Current stock, status, expiry, with category & status filters + totals
router.get('/inventory', async (req, res, next) => {
  try {
    const { category, status } = req.query;

    // Get near_expiry_days setting
    const settingRes = await db.query("SELECT value FROM system_setting WHERE key = 'near_expiry_days'");
    const nearExpiryDays = settingRes.rows.length > 0 ? parseInt(settingRes.rows[0].value, 10) : 30;

    // Auto-update expired items
    await db.query(`
      UPDATE medical_supply
      SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
      WHERE expiry_date < CURRENT_DATE AND status = 'AVAILABLE'
    `);

    let query = `
      SELECT 
        s.supply_id,
        s.name,
        s.category,
        s.batch_no,
        s.quantity,
        s.unit,
        s.min_stock_level,
        TO_CHAR(s.expiry_date, 'YYYY-MM-DD') as expiry_date,
        s.status,
        sup.name as supplier_name,
        TO_CHAR(s.updated_at, 'YYYY-MM-DD HH24:MI') as updated_at
      FROM medical_supply s
      LEFT JOIN supplier sup ON s.supplier_id = sup.supplier_id
      WHERE 1=1
    `;
    const params = [];

    if (category && category !== 'ALL') {
      params.push(category);
      query += ` AND s.category = $${params.length}`;
    }

    if (status && status !== 'ALL') {
      params.push(status);
      query += ` AND s.status = $${params.length}`;
    }

    query += ` ORDER BY s.category ASC, s.name ASC, s.batch_no ASC`;

    const result = await db.query(query, params);

    let totalQuantity = 0;
    let lowStockCount = 0;
    let expiredCount = 0;
    let nearExpiryCount = 0;

    const supplies = result.rows.map(item => {
      const computed = computeStockStatus(item, nearExpiryDays);
      const isLow = isLowStock(item.quantity, item.min_stock_level, item.status);
      const isExp = isExpired(item.expiry_date) || item.status === 'EXPIRED';
      const isNear = isNearExpiry(item.expiry_date, nearExpiryDays);

      totalQuantity += Number(item.quantity);
      if (isLow) lowStockCount++;
      if (isExp) expiredCount++;
      if (isNear) nearExpiryCount++;

      return {
        ...item,
        computed_status: computed,
        is_low_stock: isLow,
        is_expired: isExp,
        is_near_expiry: isNear
      };
    });

    return res.json({
      summary: {
        total_items: supplies.length,
        total_quantity: totalQuantity,
        low_stock_count: lowStockCount,
        expired_count: expiredCount,
        near_expiry_count: nearExpiryCount,
        near_expiry_days: nearExpiryDays
      },
      supplies
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/procurement - Orders by supplier and status within date range + totals
router.get('/procurement', async (req, res, next) => {
  try {
    const { supplier_id, status, start_date, end_date } = req.query;

    let query = `
      SELECT 
        po.order_id,
        po.supplier_id,
        sup.name as supplier_name,
        TO_CHAR(po.order_date, 'YYYY-MM-DD') as order_date,
        po.status,
        TO_CHAR(po.expected_date, 'YYYY-MM-DD') as expected_date,
        TO_CHAR(po.actual_date, 'YYYY-MM-DD') as actual_date,
        po.notes,
        u.name as created_by_name,
        (po.expected_date < CURRENT_DATE AND po.status NOT IN ('RECEIVED', 'CANCELLED')) as is_delayed,
        COUNT(poi.id)::int as item_count,
        COALESCE(SUM(poi.quantity), 0)::int as total_quantity
      FROM purchase_order po
      JOIN supplier sup ON po.supplier_id = sup.supplier_id
      LEFT JOIN users u ON po.created_by = u.user_id
      LEFT JOIN purchase_order_item poi ON po.order_id = poi.order_id
      WHERE 1=1
    `;
    const params = [];

    if (supplier_id && supplier_id !== 'ALL') {
      params.push(parseInt(supplier_id, 10));
      query += ` AND po.supplier_id = $${params.length}`;
    }

    if (status && status !== 'ALL') {
      params.push(status.toUpperCase());
      query += ` AND po.status = $${params.length}`;
    }

    if (start_date) {
      params.push(start_date);
      query += ` AND po.order_date >= $${params.length}::date`;
    }

    if (end_date) {
      params.push(end_date);
      query += ` AND po.order_date <= $${params.length}::date`;
    }

    query += `
      GROUP BY po.order_id, sup.name, u.name
      ORDER BY po.order_date DESC, po.order_id DESC
    `;

    const result = await db.query(query, params);

    let totalItemsQuantity = 0;
    let orderedCount = 0;
    let dispatchedCount = 0;
    let receivedCount = 0;
    let cancelledCount = 0;
    let delayedCount = 0;

    result.rows.forEach(o => {
      totalItemsQuantity += Number(o.total_quantity);
      if (o.status === 'ORDERED') orderedCount++;
      if (o.status === 'DISPATCHED') dispatchedCount++;
      if (o.status === 'RECEIVED') receivedCount++;
      if (o.status === 'CANCELLED') cancelledCount++;
      if (o.is_delayed) delayedCount++;
    });

    return res.json({
      summary: {
        total_orders: result.rows.length,
        total_items_quantity: totalItemsQuantity,
        ordered_count: orderedCount,
        dispatched_count: dispatchedCount,
        received_count: receivedCount,
        cancelled_count: cancelledCount,
        delayed_count: delayedCount
      },
      orders: result.rows
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
