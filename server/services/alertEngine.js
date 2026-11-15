const db = require('../config/db');

let alertInterval = null;
let evaluationQueue = Promise.resolve();

/**
 * Calculates days remaining or overdue between two dates
 */
function getDaysDiff(targetDate) {
  const d = new Date(targetDate);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = d.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Evaluates all four alert types and syncs the alert table:
 * 1. LOW_STOCK: quantity <= min_stock_level and status AVAILABLE
 * 2. NEAR_EXPIRY: expiry_date within near_expiry_days and not past
 * 3. EXPIRED: expiry_date < CURRENT_DATE and status != DISPOSED
 * 4. DELAYED_DELIVERY: PO expected_date < CURRENT_DATE and status NOT IN (RECEIVED, CANCELLED)
 */
async function runAlertEvaluation() {
  try {
    // 1. Get near_expiry_days setting
    const settingRes = await db.query("SELECT value FROM system_setting WHERE key = 'near_expiry_days'");
    const nearExpiryDays = settingRes.rows.length > 0 ? parseInt(settingRes.rows[0].value, 10) : 30;

    // 2. Auto-mark supplies past expiry date as EXPIRED
    await db.query(`
      UPDATE medical_supply
      SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
      WHERE expiry_date < CURRENT_DATE AND status = 'AVAILABLE'
    `);

    // ------------------------------------------------------------------
    // AUTO-RESOLVE alerts where conditions no longer hold
    // ------------------------------------------------------------------

    // Auto-resolve LOW_STOCK alerts if stock increased, or status is no longer AVAILABLE
    await db.query(`
      UPDATE alert a
      SET is_resolved = true
      FROM medical_supply s
      WHERE a.type = 'LOW_STOCK'
        AND a.is_resolved = false
        AND a.supply_id = s.supply_id
        AND (s.status != 'AVAILABLE' OR s.quantity > s.min_stock_level)
    `);

    // Auto-resolve NEAR_EXPIRY alerts if item expired, is beyond threshold, is disposed, or quantity is 0
    await db.query(`
      UPDATE alert a
      SET is_resolved = true
      FROM medical_supply s
      WHERE a.type = 'NEAR_EXPIRY'
        AND a.is_resolved = false
        AND a.supply_id = s.supply_id
        AND (
          s.expiry_date < CURRENT_DATE 
          OR s.expiry_date > (CURRENT_DATE + (COALESCE(s.near_expiry_days, $1) || ' days')::interval)
          OR s.status = 'DISPOSED' 
          OR s.quantity = 0
        )
    `, [nearExpiryDays]);

    // Auto-resolve EXPIRED alerts if supply is disposed or quantity is 0
    await db.query(`
      UPDATE alert a
      SET is_resolved = true
      FROM medical_supply s
      WHERE a.type = 'EXPIRED'
        AND a.is_resolved = false
        AND a.supply_id = s.supply_id
        AND (s.status = 'DISPOSED' OR s.quantity = 0 OR s.expiry_date >= CURRENT_DATE)
    `);

    // Auto-resolve DELAYED_DELIVERY alerts if PO is received, cancelled, or expected date updated
    await db.query(`
      UPDATE alert a
      SET is_resolved = true
      FROM purchase_order po
      WHERE a.type = 'DELAYED_DELIVERY'
        AND a.is_resolved = false
        AND a.order_id = po.order_id
        AND (po.status IN ('RECEIVED', 'CANCELLED') OR po.expected_date >= CURRENT_DATE)
    `);

    // Also auto-resolve orphaned alerts if supply or order was deleted
    await db.query(`
      UPDATE alert
      SET is_resolved = true
      WHERE is_resolved = false
        AND ((type IN ('LOW_STOCK', 'NEAR_EXPIRY', 'EXPIRED') AND supply_id IS NULL)
          OR (type = 'DELAYED_DELIVERY' AND order_id IS NULL))
    `);

    // ------------------------------------------------------------------
    // GENERATE NEW ALERTS (Prevent duplicates: only if no active alert exists)
    // ------------------------------------------------------------------

    // 1. LOW_STOCK alerts
    const lowStockSupplies = await db.query(`
      SELECT s.supply_id, s.name, s.batch_no, s.quantity, s.unit, s.min_stock_level
      FROM medical_supply s
      WHERE s.status = 'AVAILABLE'
        AND s.quantity <= s.min_stock_level
        AND s.expiry_date >= CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1 FROM alert a
          WHERE a.type = 'LOW_STOCK'
            AND a.supply_id = s.supply_id
            AND a.is_resolved = false
        )
    `);

    for (const s of lowStockSupplies.rows) {
      const msg = `Low stock: ${s.name} (Batch: ${s.batch_no}) has only ${s.quantity} ${s.unit} remaining (minimum threshold: ${s.min_stock_level}).`;
      await db.query(`
        INSERT INTO alert (type, supply_id, message, created_at, is_resolved)
        VALUES ('LOW_STOCK', $1, $2, CURRENT_TIMESTAMP, false)
      `, [s.supply_id, msg]);
    }

    // 2. NEAR_EXPIRY alerts
    const nearExpirySupplies = await db.query(`
      SELECT s.supply_id, s.name, s.batch_no, s.quantity, s.unit, TO_CHAR(s.expiry_date, 'YYYY-MM-DD') as expiry_date
      FROM medical_supply s
      WHERE s.status != 'DISPOSED'
        AND s.quantity > 0
        AND s.expiry_date >= CURRENT_DATE
        AND s.expiry_date <= (CURRENT_DATE + (COALESCE(s.near_expiry_days, $1) || ' days')::interval)
        AND NOT EXISTS (
          SELECT 1 FROM alert a
          WHERE a.type = 'NEAR_EXPIRY'
            AND a.supply_id = s.supply_id
            AND a.is_resolved = false
        )
    `, [nearExpiryDays]);

    for (const s of nearExpirySupplies.rows) {
      const days = getDaysDiff(s.expiry_date);
      const msg = `Near expiry: ${s.name} (Batch: ${s.batch_no}) expires in ${days} day(s) on ${s.expiry_date}. Current stock: ${s.quantity} ${s.unit}.`;
      await db.query(`
        INSERT INTO alert (type, supply_id, message, created_at, is_resolved)
        VALUES ('NEAR_EXPIRY', $1, $2, CURRENT_TIMESTAMP, false)
      `, [s.supply_id, msg]);
    }

    // 3. EXPIRED alerts
    const expiredSupplies = await db.query(`
      SELECT s.supply_id, s.name, s.batch_no, s.quantity, s.unit, TO_CHAR(s.expiry_date, 'YYYY-MM-DD') as expiry_date
      FROM medical_supply s
      WHERE s.status != 'DISPOSED'
        AND s.quantity > 0
        AND s.expiry_date < CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1 FROM alert a
          WHERE a.type = 'EXPIRED'
            AND a.supply_id = s.supply_id
            AND a.is_resolved = false
        )
    `);

    for (const s of expiredSupplies.rows) {
      const days = Math.abs(getDaysDiff(s.expiry_date));
      const msg = `Expired supply: ${s.name} (Batch: ${s.batch_no}) expired ${days} day(s) ago on ${s.expiry_date}. ${s.quantity} ${s.unit} must be quarantined and disposed.`;
      await db.query(`
        INSERT INTO alert (type, supply_id, message, created_at, is_resolved)
        VALUES ('EXPIRED', $1, $2, CURRENT_TIMESTAMP, false)
      `, [s.supply_id, msg]);
    }

    // 4. DELAYED_DELIVERY alerts
    const delayedOrders = await db.query(`
      SELECT po.order_id, TO_CHAR(po.expected_date, 'YYYY-MM-DD') as expected_date, po.status, sup.name as supplier_name
      FROM purchase_order po
      JOIN supplier sup ON po.supplier_id = sup.supplier_id
      WHERE po.expected_date < CURRENT_DATE
        AND po.status NOT IN ('RECEIVED', 'CANCELLED')
        AND NOT EXISTS (
          SELECT 1 FROM alert a
          WHERE a.type = 'DELAYED_DELIVERY'
            AND a.order_id = po.order_id
            AND a.is_resolved = false
        )
    `);

    for (const po of delayedOrders.rows) {
      const days = Math.abs(getDaysDiff(po.expected_date));
      const msg = `Delayed delivery: Purchase Order #${po.order_id} from ${po.supplier_name} was expected on ${po.expected_date} (${days} day(s) overdue). Status: ${po.status}.`;
      await db.query(`
        INSERT INTO alert (type, order_id, message, created_at, is_resolved)
        VALUES ('DELAYED_DELIVERY', $1, $2, CURRENT_TIMESTAMP, false)
      `, [po.order_id, msg]);
    }
  } catch (err) {
    if (err.message && err.message.includes('Cannot use a pool after calling end')) {
      return;
    }
    console.error('[ALERT ENGINE ERROR]', err.message);
  }
}

/**
 * Queues evaluateAlerts calls sequentially using a promise chain
 * to avoid duplicate alert race conditions. One failure does not block the queue.
 */
function evaluateAlerts() {
  const next = evaluationQueue.then(
    () => runAlertEvaluation(),
    () => runAlertEvaluation()
  );
  evaluationQueue = next.catch(() => {});
  return next;
}

let lastEvaluationTime = 0;

/**
 * Awaits evaluateAlerts(), throttled to at most once per 30 seconds per instance.
 */
async function evaluateAlertsThrottled(minIntervalMs = 30000) {
  const now = Date.now();
  if (now - lastEvaluationTime >= minIntervalMs) {
    lastEvaluationTime = now;
    await evaluateAlerts();
  }
}

/**
 * Starts hourly periodic background check
 */
function startAlertScheduler() {
  if (alertInterval) clearInterval(alertInterval);
  // Run once immediately
  evaluateAlerts().catch(err => console.error('[ALERT ENGINE STARTUP ERROR]', err));
  // Every 1 hour (3600000 ms)
  alertInterval = setInterval(() => {
    evaluateAlerts().catch(err => console.error('[ALERT ENGINE PERIODIC ERROR]', err));
  }, 60 * 60 * 1000);
  if (alertInterval.unref) alertInterval.unref(); // Allow node process to exit gracefully in tests
}

function stopAlertScheduler() {
  if (alertInterval) {
    clearInterval(alertInterval);
    alertInterval = null;
  }
}

module.exports = {
  runAlertEvaluation,
  evaluateAlerts,
  evaluateAlertsThrottled,
  startAlertScheduler,
  stopAlertScheduler
};
