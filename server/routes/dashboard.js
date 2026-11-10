const express = require('express');
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { isExpired, isNearExpiry, isLowStock } = require('../utils/stockUtils');

const router = express.Router();

router.use(authenticate);

// GET /api/dashboard/stats
router.get('/stats', async (req, res, next) => {
  try {
    const user = req.session.user;
    const role = user.role;

    // Fetch near expiry days setting
    const settingRes = await db.query('SELECT value FROM system_setting WHERE key = $1', ['near_expiry_days']);
    const nearExpiryDays = settingRes.rows.length > 0 ? parseInt(settingRes.rows[0].value, 10) : 30;

    // Auto-update expired supplies
    await db.query(`
      UPDATE medical_supply 
      SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP 
      WHERE expiry_date < CURRENT_DATE AND status = 'AVAILABLE'
    `);

    const stats = {
      role: role,
      userName: user.name
    };

    if (role === 'Inventory Manager' || role === 'Hospital Administrator') {
      const suppliesRes = await db.query(`
        SELECT supply_id, quantity, min_stock_level, expiry_date, status, category
        FROM medical_supply
      `);

      let totalSupplies = suppliesRes.rows.length;
      let lowStockCount = 0;
      let expiredCount = 0;
      let nearExpiryCount = 0;
      let disposedCount = 0;
      let availableTotalStock = 0;

      // Category aggregation for chart (AVAILABLE only)
      const categoryMap = {};

      suppliesRes.rows.forEach(item => {
        const exp = isExpired(item.expiry_date) || item.status === 'EXPIRED';
        const near = isNearExpiry(item.expiry_date, nearExpiryDays);
        const low = isLowStock(item.quantity, item.min_stock_level, item.status);

        if (item.status === 'DISPOSED') {
          disposedCount++;
        } else if (exp) {
          expiredCount++;
        } else {
          availableTotalStock += Number(item.quantity);
          if (low) lowStockCount++;
          if (near) nearExpiryCount++;
        }

        // Track category totals for AVAILABLE items only
        if (item.status === 'AVAILABLE' && !exp) {
          const cat = item.category || 'Uncategorised';
          categoryMap[cat] = (categoryMap[cat] || 0) + Number(item.quantity);
        }
      });

      const reqRes = await db.query(`
        SELECT COUNT(*) as pending_requests 
        FROM supply_request 
        WHERE status = 'PENDING'
      `);

      stats.totalSupplies = totalSupplies;
      stats.lowStockCount = lowStockCount;
      stats.expiredCount = expiredCount;
      stats.nearExpiryCount = nearExpiryCount;
      stats.disposedCount = disposedCount;
      stats.availableTotalStock = availableTotalStock;
      stats.pendingRequests = parseInt(reqRes.rows[0].pending_requests, 10);
      stats.categoryChartData = {
        labels: Object.keys(categoryMap),
        values: Object.values(categoryMap)
      };
    }

    if (role === 'Hospital Administrator') {
      const userRes = await db.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE is_active = true) as active_users
        FROM users
      `);
      stats.totalUsers = parseInt(userRes.rows[0].total_users, 10);
      stats.activeUsers = parseInt(userRes.rows[0].active_users, 10);

      const storeRes = await db.query("SELECT name, min_stock_level, TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI') as last_updated FROM inventory LIMIT 1");
      stats.storeInfo = storeRes.rows[0] || null;

      // Open + delayed orders for admin view
      const poRes = await db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status IN ('ORDERED', 'DISPATCHED')) as open_orders,
          COUNT(*) FILTER (WHERE expected_date < CURRENT_DATE AND status NOT IN ('RECEIVED', 'CANCELLED')) as delayed_orders
        FROM purchase_order
      `);
      stats.openOrders = parseInt(poRes.rows[0].open_orders || 0, 10);
      stats.delayedOrders = parseInt(poRes.rows[0].delayed_orders || 0, 10);
    }

    if (role === 'Hospital Department Staff') {
      const myReqRes = await db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'PENDING') as my_pending,
          COUNT(*) FILTER (WHERE status = 'APPROVED') as my_approved,
          COUNT(*) FILTER (WHERE status = 'REJECTED') as my_rejected,
          COUNT(*) as my_total
        FROM supply_request
        WHERE requested_by = $1
      `, [user.user_id]);

      const availRes = await db.query(`
        SELECT COUNT(*) as available_count
        FROM medical_supply
        WHERE status = 'AVAILABLE' AND expiry_date >= CURRENT_DATE AND quantity > 0
      `);

      stats.myPendingRequests = parseInt(myReqRes.rows[0].my_pending || 0, 10);
      stats.myApprovedRequests = parseInt(myReqRes.rows[0].my_approved || 0, 10);
      stats.myRejectedRequests = parseInt(myReqRes.rows[0].my_rejected || 0, 10);
      stats.myTotalRequests = parseInt(myReqRes.rows[0].my_total || 0, 10);
      stats.availableCatalogItems = parseInt(availRes.rows[0].available_count || 0, 10);
    }

    if (role === 'Procurement Officer') {
      const poRes = await db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status IN ('ORDERED', 'DISPATCHED')) as open_orders,
          COUNT(*) FILTER (WHERE expected_date < CURRENT_DATE AND status NOT IN ('RECEIVED', 'CANCELLED')) as delayed_orders,
          COUNT(*) FILTER (WHERE status = 'RECEIVED' AND actual_date >= DATE_TRUNC('month', CURRENT_DATE)::date) as received_this_month,
          COUNT(*) as total_orders
        FROM purchase_order
      `);

      stats.openOrders = parseInt(poRes.rows[0].open_orders || 0, 10);
      stats.delayedOrders = parseInt(poRes.rows[0].delayed_orders || 0, 10);
      stats.receivedThisMonth = parseInt(poRes.rows[0].received_this_month || 0, 10);
      stats.totalOrders = parseInt(poRes.rows[0].total_orders || 0, 10);
    }

    if (role === 'Supplier / Vendor') {
      const supId = user.supplier_id;
      const vendRes = await db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'ORDERED') as awaiting_dispatch,
          COUNT(*) FILTER (WHERE status = 'DISPATCHED') as dispatched_orders,
          COUNT(*) FILTER (WHERE status = 'RECEIVED') as received_orders,
          COUNT(*) as total_orders
        FROM purchase_order
        WHERE supplier_id = $1
      `, [supId || 0]);

      stats.ordersAwaitingDispatch = parseInt(vendRes.rows[0].awaiting_dispatch || 0, 10);
      stats.dispatchedOrders = parseInt(vendRes.rows[0].dispatched_orders || 0, 10);
      stats.receivedOrders = parseInt(vendRes.rows[0].received_orders || 0, 10);
      stats.totalOrders = parseInt(vendRes.rows[0].total_orders || 0, 10);
    }

    // Urgent alerts for the current user's role (top 5, unresolved)
    const alertTypes = role === 'Hospital Administrator'
      ? ['LOW_STOCK', 'NEAR_EXPIRY', 'EXPIRED', 'DELAYED_DELIVERY']
      : role === 'Inventory Manager'
        ? ['LOW_STOCK', 'NEAR_EXPIRY', 'EXPIRED']
        : role === 'Procurement Officer'
          ? ['DELAYED_DELIVERY']
          : [];

    if (alertTypes.length > 0) {
      const urgentAlertsRes = await db.query(`
        SELECT alert_id, type, supply_id, order_id, message, 
               TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created_at
        FROM alert
        WHERE is_resolved = false AND type = ANY($1)
        ORDER BY 
          CASE type 
            WHEN 'EXPIRED' THEN 1
            WHEN 'DELAYED_DELIVERY' THEN 2
            WHEN 'LOW_STOCK' THEN 3
            WHEN 'NEAR_EXPIRY' THEN 4
          END,
          created_at DESC
        LIMIT 5
      `, [alertTypes]);
      stats.urgentAlerts = urgentAlertsRes.rows;
      stats.totalUnresolvedAlerts = await db.query(
        'SELECT COUNT(*)::int as count FROM alert WHERE is_resolved = false AND type = ANY($1)',
        [alertTypes]
      ).then(r => r.rows[0].count);
    } else {
      stats.urgentAlerts = [];
      stats.totalUnresolvedAlerts = 0;
    }

    return res.json({ stats });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
