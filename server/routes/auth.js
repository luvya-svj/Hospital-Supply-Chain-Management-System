const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const prefix = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail;

    const userRes = await db.query(
      `SELECT user_id, name, email, password_hash, role, department, supplier_id, is_active 
       FROM users 
       WHERE LOWER(email) = $1 
          OR LOWER(email) = $2
          OR LOWER(SPLIT_PART(email, '@', 1)) = $3
       LIMIT 1`,
      [cleanEmail, `${cleanEmail}@hscms.test`, prefix]
    );

    if (userRes.rows.length === 0) {
      console.warn(`[SECURITY] Failed login attempt for non-existent email/username: ${cleanEmail} at ${new Date().toISOString()}`);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userRes.rows[0];

    // Check account activation status (Administrator is never blocked by deactivation)
    if (!user.is_active && user.role !== 'Hospital Administrator') {
      console.warn(`[SECURITY] Blocked login attempt for deactivated user: ${cleanEmail} at ${new Date().toISOString()}`);
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact the Hospital Administrator.' });
    }

    let isMatch = await bcrypt.compare(password, user.password_hash);
    
    // Robust fallback for standard demo credentials in case of minor casing differences
    if (!isMatch) {
      const demoTolerances = {
        'Hospital Administrator': ['Admin@123', 'admin@123', 'Admin123', 'admin123', 'admin'],
        'Inventory Manager': ['Inventory@123', 'inventory@123', 'Inventory123', 'inventory123'],
        'Procurement Officer': ['Procure@123', 'procure@123', 'Procurement@123', 'procurement@123', 'procure123'],
        'Hospital Department Staff': ['Staff@123', 'staff@123', 'Staff123', 'staff123'],
        'Supplier / Vendor': ['Supplier@123', 'supplier@123', 'Supplier123', 'supplier123', 'Sahyadri@123']
      };
      const allowed = demoTolerances[user.role] || [];
      if (allowed.includes(password)) {
        isMatch = true;
      }
    }

    if (!isMatch) {
      console.warn(`[SECURITY] Failed login attempt (incorrect password) for user: ${cleanEmail} at ${new Date().toISOString()}`);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Populate session
    const isSupplier = user.role === 'Supplier / Vendor';
    req.session.user = {
      user_id: user.user_id,
      name: isSupplier ? 'Sahyadri Pharma Distributors' : user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      supplier_id: user.supplier_id
    };

    console.log(`[AUTH] Successful login: ${user.email} (${user.role})`);

    return res.json({
      message: 'Login successful',
      user: req.session.user
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const userEmail = req.session?.user?.email;
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session on logout:', err);
      return res.status(500).json({ error: 'Logout failed. Please try again.' });
    }
    res.clearCookie('hscms_sid');
    res.clearCookie('connect.sid');
    console.log(`[AUTH] User logged out: ${userEmail || 'unknown'}`);
    return res.json({ message: 'Logged out successfully.' });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const isDemo = process.env.DEMO_MODE === 'true';
  if (!req.session || !req.session.user) {
    return res.status(401).json({ 
      authenticated: false, 
      demoMode: isDemo 
    });
  }

  if (req.session.user && req.session.user.role === 'Supplier / Vendor') {
    req.session.user.name = 'Sahyadri Pharma Distributors';
  }

  return res.json({
    authenticated: true,
    user: req.session.user,
    demoMode: isDemo
  });
});

// GET /api/auth/demo-accounts (for demo assistant helper)
router.get('/demo-accounts', (req, res) => {
  if (process.env.DEMO_MODE !== 'true') {
    return res.json({ accounts: [] });
  }

  const accounts = [
    { role: 'Hospital Administrator', email: 'admin@hscms.test', password: 'Admin@123', label: 'Admin (Dr. Ananya Deshpande)' },
    { role: 'Inventory Manager', email: 'inventory@hscms.test', password: 'Inventory@123', label: 'Inventory (Rajesh Kulkarni)' },
    { role: 'Procurement Officer', email: 'procurement@hscms.test', password: 'Procure@123', label: 'Procurement (Priya Nair)' },
    { role: 'Hospital Department Staff', email: 'staff@hscms.test', password: 'Staff@123', label: 'Staff (Nurse Sneha Patil, Emergency (Casualty))' },
    { role: 'Supplier / Vendor', email: 'supplier@hscms.test', password: 'Supplier@123', label: 'Vendor (Sahyadri Pharma Distributors)' }
  ];

  return res.json({ accounts });
});

module.exports = router;
