const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const VALID_ROLES = [
  'Hospital Administrator',
  'Inventory Manager',
  'Procurement Officer',
  'Hospital Department Staff',
  'Supplier / Vendor'
];

// All user management routes require Hospital Administrator
router.use(authenticate, requireRole('Hospital Administrator'));

// GET /api/users - List users
router.get('/', async (req, res, next) => {
  try {
    const { role, status, search } = req.query;
    let query = `
      SELECT u.user_id, u.name, u.email, u.role, u.department, u.contact, u.is_active, u.created_at,
             s.name as supplier_name, u.supplier_id
      FROM users u
      LEFT JOIN supplier s ON u.supplier_id = s.supplier_id
      WHERE 1=1
    `;
    const params = [];

    if (role) {
      params.push(role);
      query += ` AND u.role = $${params.length}`;
    }

    if (status !== undefined && status !== '') {
      params.push(status === 'active' || status === 'true');
      query += ` AND u.is_active = $${params.length}`;
    }

    if (search) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length} OR LOWER(COALESCE(u.department, '')) LIKE $${params.length})`;
    }

    query += ' ORDER BY u.user_id ASC';

    const result = await db.query(query, params);
    return res.json({ users: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/users - Add user
router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, role, department, contact, supplier_id } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required fields.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role specified. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    if (role === 'Hospital Department Staff' && !department?.trim()) {
      return res.status(400).json({ error: 'Department is required for Hospital Department Staff.' });
    }

    // Check duplicate email
    const duplicate = await db.query('SELECT user_id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (duplicate.rows.length > 0) {
      return res.status(400).json({ error: 'A user with this email address already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const insertResult = await db.query(`
      INSERT INTO users (name, email, password_hash, role, department, contact, supplier_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING user_id, name, email, role, department, contact, is_active, created_at
    `, [
      name.trim(),
      cleanEmail,
      passwordHash,
      role,
      department?.trim() || null,
      contact?.trim() || null,
      supplier_id ? parseInt(supplier_id, 10) : null
    ]);

    return res.status(201).json({
      message: 'User account created successfully.',
      user: insertResult.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { name, email, password, role, department, contact, supplier_id } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ error: 'Name, email, and role are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role specified.` });
    }

    // Check email uniqueness against other users
    const duplicate = await db.query('SELECT user_id FROM users WHERE LOWER(email) = $1 AND user_id != $2', [cleanEmail, userId]);
    if (duplicate.rows.length > 0) {
      return res.status(400).json({ error: 'Another user with this email address already exists.' });
    }

    let updateQuery;
    let params;

    if (password && password.trim()) {
      const passwordHash = await bcrypt.hash(password.trim(), 10);
      updateQuery = `
        UPDATE users 
        SET name = $1, email = $2, password_hash = $3, role = $4, department = $5, contact = $6, supplier_id = $7
        WHERE user_id = $8
        RETURNING user_id, name, email, role, department, contact, is_active
      `;
      params = [name.trim(), cleanEmail, passwordHash, role, department?.trim() || null, contact?.trim() || null, supplier_id ? parseInt(supplier_id, 10) : null, userId];
    } else {
      updateQuery = `
        UPDATE users 
        SET name = $1, email = $2, role = $3, department = $4, contact = $5, supplier_id = $6
        WHERE user_id = $7
        RETURNING user_id, name, email, role, department, contact, is_active
      `;
      params = [name.trim(), cleanEmail, role, department?.trim() || null, contact?.trim() || null, supplier_id ? parseInt(supplier_id, 10) : null, userId];
    }

    const result = await db.query(updateQuery, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // If admin updated their own profile in session, update session
    if (req.session.user.user_id === userId) {
      req.session.user.name = result.rows[0].name;
      req.session.user.email = result.rows[0].email;
      req.session.user.role = result.rows[0].role;
    }

    return res.json({
      message: 'User account updated successfully.',
      user: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id/status - Deactivate or reactivate user
router.patch('/:id/status', async (req, res, next) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const currentUserId = req.session.user.user_id;
    const { is_active } = req.body;

    if (is_active === undefined) {
      return res.status(400).json({ error: 'Field is_active is required.' });
    }

    // Requirement: "An admin cannot deactivate their own account."
    if (targetUserId === currentUserId && !is_active) {
      return res.status(400).json({ error: 'Hospital Administrators cannot deactivate their own account.' });
    }

    const result = await db.query(
      'UPDATE users SET is_active = $1 WHERE user_id = $2 RETURNING user_id, name, email, is_active',
      [!!is_active, targetUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json({
      message: `User account has been ${is_active ? 'reactivated' : 'deactivated'} successfully.`,
      user: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
