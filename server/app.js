const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('./config/db');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const settingsRouter = require('./routes/settings');
const inventoryRouter = require('./routes/inventory');
const requestsRouter = require('./routes/requests');
const dashboardRouter = require('./routes/dashboard');
const suppliersRouter = require('./routes/suppliers');
const ordersRouter = require('./routes/orders');
const alertsRouter = require('./routes/alerts');
const disposalRouter = require('./routes/disposal');
const reportsRouter = require('./routes/reports');
const activityRouter = require('./routes/activity');

const app = express();

app.set('trust proxy', 1);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const isProduction = process.env.NODE_ENV === 'production';

// Session configuration with PostgreSQL store
app.use(session({
  store: new pgSession({
    pool: pool,
    createTableIfMissing: true
  }),
  name: 'hscms_sid',
  secret: process.env.SESSION_SECRET || 'hscms_super_secret_session_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Static files served from /public
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/supplies', inventoryRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/disposals', disposalRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/activity', activityRouter);

// Central error handler
app.use(errorHandler);

module.exports = app;
