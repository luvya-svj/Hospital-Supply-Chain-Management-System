const express = require('express');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRole('Hospital Administrator'));

// GET /api/activity/staff - Hospital Department Staff Requisition Activity
router.get('/staff', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        sr.request_id,
        TO_CHAR(sr.request_date, 'YYYY-MM-DD HH24:MI') as request_date,
        u.name as staff_name,
        u.email as staff_email,
        sr.department,
        s.name as supply_name,
        s.batch_no,
        s.unit,
        sr.quantity,
        sr.status,
        COALESCE(decider.name, 'Pending Review') as decided_by_name,
        COALESCE(TO_CHAR(sr.decided_at, 'YYYY-MM-DD HH24:MI'), '-') as decided_at
      FROM supply_request sr
      JOIN users u ON sr.requested_by = u.user_id
      JOIN medical_supply s ON sr.supply_id = s.supply_id
      LEFT JOIN users decider ON sr.decided_by = decider.user_id
      ORDER BY sr.request_date DESC
    `);
    return res.json({ activities: result.rows, total: result.rows.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/activity/inventory - Inventory Manager Stock Decisions & Disposals
router.get('/inventory', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        'DECISION' as record_type,
        sr.request_id as record_id,
        TO_CHAR(sr.decided_at, 'YYYY-MM-DD HH24:MI') as activity_date,
        decider.name as manager_name,
        s.name as supply_name,
        s.batch_no,
        CONCAT(sr.quantity, ' ', s.unit) as quantity,
        CASE WHEN sr.status = 'APPROVED' THEN 'Approved Requisition' ELSE 'Rejected Requisition' END as action,
        CONCAT('Requisition for ', sr.department, ' requested by ', requester.name) as context,
        sr.status as status
      FROM supply_request sr
      JOIN users decider ON sr.decided_by = decider.user_id
      JOIN users requester ON sr.requested_by = requester.user_id
      JOIN medical_supply s ON sr.supply_id = s.supply_id
      WHERE sr.decided_at IS NOT NULL

      UNION ALL

      SELECT 
        'DISPOSAL' as record_type,
        d.disposal_id as record_id,
        TO_CHAR(d.disposal_date, 'YYYY-MM-DD') as activity_date,
        u.name as manager_name,
        s.name as supply_name,
        s.batch_no,
        CONCAT(d.quantity, ' ', s.unit) as quantity,
        'Disposed Medical Supply' as action,
        CONCAT('Reason: ', d.reason, ' (Remaining: ', s.quantity, ' ', s.unit, ')') as context,
        'DISPOSED' as status
      FROM disposal_record d
      JOIN users u ON d.recorded_by = u.user_id
      JOIN medical_supply s ON d.supply_id = s.supply_id

      ORDER BY activity_date DESC
    `);
    return res.json({ activities: result.rows, total: result.rows.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/activity/procurement - Procurement Officer Purchase Orders
router.get('/procurement', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        po.order_id,
        TO_CHAR(po.order_date, 'YYYY-MM-DD') as order_date,
        TO_CHAR(po.expected_date, 'YYYY-MM-DD') as expected_date,
        u.name as officer_name,
        sup.name as supplier_name,
        po.status,
        po.notes,
        COALESCE(
          (SELECT string_agg(CONCAT(poi.quantity, ' ', ms.unit, ' x ', ms.name), '; ')
           FROM purchase_order_item poi
           JOIN medical_supply ms ON poi.supply_id = ms.supply_id
           WHERE poi.order_id = po.order_id),
          'No items'
        ) as items_summary,
        COALESCE(
          (SELECT SUM(poi.quantity)::int
           FROM purchase_order_item poi
           WHERE poi.order_id = po.order_id),
          0
        ) as total_quantity
      FROM purchase_order po
      JOIN users u ON po.created_by = u.user_id
      JOIN supplier sup ON po.supplier_id = sup.supplier_id
      ORDER BY po.order_date DESC, po.order_id DESC
    `);
    return res.json({ activities: result.rows, total: result.rows.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/activity/supplier - Supplier / Vendor Dispatches & Tracking
router.get('/supplier', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        po.order_id,
        sup.name as supplier_name,
        sup.contact as supplier_contact,
        TO_CHAR(po.order_date, 'YYYY-MM-DD') as order_date,
        TO_CHAR(po.expected_date, 'YYYY-MM-DD') as expected_date,
        TO_CHAR(po.dispatch_date, 'YYYY-MM-DD') as dispatch_date,
        TO_CHAR(po.actual_date, 'YYYY-MM-DD') as actual_date,
        po.status,
        po.notes,
        CASE 
          WHEN po.status = 'DISPATCHED' AND po.dispatch_date > CURRENT_DATE THEN 'SCHEDULED_DISPATCH'
          ELSE po.status 
        END as display_status,
        COALESCE(
          (SELECT string_agg(CONCAT(poi.quantity, ' ', ms.unit, ' x ', ms.name), '; ')
           FROM purchase_order_item poi
           JOIN medical_supply ms ON poi.supply_id = ms.supply_id
           WHERE poi.order_id = po.order_id),
          'No items'
        ) as items_summary
      FROM purchase_order po
      JOIN supplier sup ON po.supplier_id = sup.supplier_id
      ORDER BY COALESCE(po.dispatch_date, po.order_date) DESC, po.order_id DESC
    `);
    return res.json({ activities: result.rows, total: result.rows.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
