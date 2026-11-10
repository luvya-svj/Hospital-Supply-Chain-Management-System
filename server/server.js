const app = require('./app');
const { startAlertScheduler } = require('./services/alertEngine');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Hospital Supply Chain Management System (HSCMS)`);
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`Demo Mode: ${process.env.DEMO_MODE === 'true' ? 'ENABLED' : 'DISABLED'}`);
  console.log(`====================================================`);

  // Start the alert evaluation engine on boot, then every hour
  startAlertScheduler();
  console.log(`[ALERT ENGINE] Alert scheduler started. Evaluating alerts now and every hour.`);

  // Ensure supplier user display name is updated to Sahyadri Pharma Distributors
  const db = require('./config/db');
  db.query("UPDATE users SET name = 'Sahyadri Pharma Distributors' WHERE role = 'Supplier / Vendor' OR email = 'supplier@hscms.test'").catch(() => {});
  // Ensure product-level near expiry threshold column exists
  db.query("ALTER TABLE medical_supply ADD COLUMN IF NOT EXISTS near_expiry_days INTEGER DEFAULT NULL").catch(() => {});
  // Ensure default Administrator account is active and can log in with Admin@123
  const bcrypt = require('bcryptjs');
  bcrypt.hash('Admin@123', 10).then(hash => {
    db.query("UPDATE users SET password_hash = $1, is_active = true WHERE LOWER(email) = 'admin@hscms.test' OR role = 'Hospital Administrator'", [hash]).catch(() => {});
  }).catch(() => {});
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
