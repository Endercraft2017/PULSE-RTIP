/**
 * =============================================================================
 * PULSE-RTIP Express Server
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. App Initialization
 * 3. Security Middleware
 * 4. Request Parsing & Logging
 * 5. Rate Limiting
 * 6. API Routes
 * 7. Static File Serving
 * 8. Error Handling
 * 9. Server Startup
 *
 * Main entry point for the PULSE-RTIP backend. Sets up Express with
 * security middleware, mounts API routes, and serves the frontend SPA.
 * =============================================================================
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const db = require('./config/database');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const smsPoller = require('./services/sms/smsPoller');

/* --------------------------------------------------------------------------
 * 2. App Initialization
 * -------------------------------------------------------------------------- */

const app = express();

/* --------------------------------------------------------------------------
 * 3. Security Middleware
 * -------------------------------------------------------------------------- */

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: config.appMode === 'production'
    ? [`http://${config.mysql.host}`, `http://localhost:${config.port}`]
    : '*',
  credentials: true,
}));

/* --------------------------------------------------------------------------
 * 4. Request Parsing & Logging
 * -------------------------------------------------------------------------- */

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

/* --------------------------------------------------------------------------
 * 5. Rate Limiting
 * -------------------------------------------------------------------------- */

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

app.use('/api', limiter);

/* --------------------------------------------------------------------------
 * 6. API Routes
 * -------------------------------------------------------------------------- */

app.use('/api', routes);

/* --------------------------------------------------------------------------
 * 7. Static File Serving
 * -------------------------------------------------------------------------- */

if (!fs.existsSync(config.upload.dir)) {
  fs.mkdirSync(config.upload.dir, { recursive: true });
}
app.use('/uploads', express.static(config.upload.dir));

app.use(express.static(config.frontendPath));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(config.frontendPath, 'index.html'));
  }
});

/* --------------------------------------------------------------------------
 * 8. Error Handling
 * -------------------------------------------------------------------------- */

app.use(errorHandler);

/* --------------------------------------------------------------------------
 * 9. Server Startup
 * -------------------------------------------------------------------------- */

async function start() {
  try {
    await db.initialize();
    smsPoller.start();
    app.listen(config.port, () => {
      console.log(`\n========================================`);
      console.log(`  PULSE-RTIP Server`);
      console.log(`  Mode: ${config.appMode}`);
      console.log(`  Port: ${config.port}`);
      console.log(`  URL:  http://localhost:${config.port}`);
      console.log(`  API:  http://localhost:${config.port}/api`);
      console.log(`========================================\n`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err.message);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\n[Server] Shutting down...');
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await db.close();
  process.exit(0);
});

start();

module.exports = app;
