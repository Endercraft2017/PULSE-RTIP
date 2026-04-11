/**
 * =============================================================================
 * PULSE-RTIP Database Seeder
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. Seed Data Definitions
 * 3. Seed Functions
 * 4. Main Entry Point
 *
 * Populates the database with demo data for development and offline mode.
 * Creates sample users, reports, hazard alerts, notifications, and hotlines.
 *
 * Usage: node src/database/seeds/seed.js
 * =============================================================================
 */

const path = require('path');

// Resolve modules from the backend's node_modules
const backendDir = path.resolve(__dirname, '../../backend');
const bcrypt = require(path.join(backendDir, 'node_modules/bcryptjs'));
const config = require(path.join(backendDir, 'config'));
const db = require(path.join(backendDir, 'config/database'));

/* --------------------------------------------------------------------------
 * 2. Seed Data Definitions
 * -------------------------------------------------------------------------- */

const USERS = [
  {
    name: 'MDRRMO Admin',
    email: 'admin@mdrrmo.gov',
    phone: '0917-135-0541',
    address: 'MDRRMO Office, Morong, Rizal',
    avatar: 'M',
    role: 'admin',
    password: 'admin123',
  },
  {
    name: 'Ray Ban Lopez',
    email: 'ray.lopez@email.com',
    phone: '0917-123-4567',
    address: 'San Pedro (Pob.)',
    avatar: 'R',
    role: 'citizen',
    password: 'citizen123',
  },
];

const REPORTS = [
  {
    title: 'Flood on Main Street',
    type: 'Flood',
    status: 'investigating',
    description: 'Heavy flooding on Main Street near the municipal hall. Water level is approximately knee-deep and rising.',
    location: 'Main Street, Morong, Rizal',
    latitude: 14.5131,
    longitude: 121.2365,
    submitted_by: 2,
  },
  {
    title: 'Fallen Tree Blocking Road',
    type: 'Infrastructure Damage',
    status: 'pending',
    description: 'A large tree fell due to strong winds and is blocking the main road near Barangay San Juan.',
    location: 'Brgy. San Juan, Morong, Rizal',
    latitude: 14.5098,
    longitude: 121.2401,
    submitted_by: 2,
  },
  {
    title: 'Fire at Commercial Building',
    type: 'Fire',
    status: 'resolved',
    description: 'Fire broke out at a commercial building near the public market. Fire department responded and contained the fire.',
    location: 'Public Market, Morong, Rizal',
    latitude: 14.5145,
    longitude: 121.2350,
    submitted_by: 2,
  },
];

const HAZARDS = [
  {
    title: 'Flood Warning',
    severity: 'high',
    location: 'Main Street, Morong',
    description: 'Heavy rainfall expected. Flood warning in low-lying areas near Main Street and the river basin.',
  },
  {
    title: 'Fire Alert',
    severity: 'medium',
    location: 'Commercial District, Morong',
    description: 'Fire risk elevated due to dry conditions. Exercise caution in commercial areas.',
  },
  {
    title: 'Landslide Advisory',
    severity: 'low',
    location: 'Mountain Areas, Morong',
    description: 'Minor landslide risk in elevated areas due to recent rainfall. Monitor conditions.',
  },
];

const HOTLINES = [
  { category: 'MDRRMO', label: 'Emergency', number: '0917-135-0541', sort_order: 1 },
  { category: 'MDRRMO', label: 'Mobile', number: '0919-081-7181', sort_order: 2 },
  { category: 'MDRRMO', label: 'Landline 1', number: '(02) 7212-5741', sort_order: 3 },
  { category: 'MDRRMO', label: 'Landline 2', number: '(02) 8786-9398', sort_order: 4 },
  { category: 'Police', label: 'PNP Morong', number: '(02) 8234-5678', sort_order: 5 },
  { category: 'Hospital', label: 'Morong General Hospital', number: '(02) 8654-3210', sort_order: 6 },
  { category: 'Fire', label: 'BFP Morong', number: '(02) 8765-4321', sort_order: 7 },
  { category: 'Red Cross', label: 'Philippine Red Cross', number: '143', sort_order: 8 },
];

/* --------------------------------------------------------------------------
 * 3. Seed Functions
 * -------------------------------------------------------------------------- */

/**
 * Seeds users into the database.
 * @returns {Promise<void>}
 */
async function seedUsers() {
  for (const user of USERS) {
    const hash = await bcrypt.hash(user.password, 10);
    await db.query(
      `INSERT INTO users (name, email, phone, address, avatar, role, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.name, user.email, user.phone, user.address, user.avatar, user.role, hash]
    );
  }
  console.log(`  [OK] Seeded ${USERS.length} users`);
}

/**
 * Seeds reports into the database.
 * @returns {Promise<void>}
 */
async function seedReports() {
  for (const report of REPORTS) {
    await db.query(
      `INSERT INTO reports (title, type, status, description, location, latitude, longitude, submitted_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [report.title, report.type, report.status, report.description, report.location, report.latitude, report.longitude, report.submitted_by]
    );
  }
  console.log(`  [OK] Seeded ${REPORTS.length} reports`);
}

/**
 * Seeds hazard alerts into the database.
 * @returns {Promise<void>}
 */
async function seedHazards() {
  for (const hazard of HAZARDS) {
    await db.query(
      `INSERT INTO hazard_alerts (title, severity, location, description, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [hazard.title, hazard.severity, hazard.location, hazard.description, 1]
    );
  }
  console.log(`  [OK] Seeded ${HAZARDS.length} hazard alerts`);
}

/**
 * Seeds notifications into the database.
 * @returns {Promise<void>}
 */
async function seedNotifications() {
  const notifications = [
    {
      user_id: 2, report_id: 1,
      title: 'Report Status Update',
      text: 'Your flood report on Main Street is now being investigated by the MDRRMO team.',
      status: 'investigating',
    },
    {
      user_id: 2, report_id: 3,
      title: 'Report Resolved',
      text: 'The infrastructure damage you reported has been resolved. Thank you for your report.',
      status: 'resolved',
    },
    {
      user_id: 2, report_id: 1,
      title: 'Status Update',
      text: 'Your recent flood report is now under investigation by the response team.',
      status: 'investigating',
    },
    {
      user_id: 2, report_id: 2,
      title: 'Report Pending',
      text: 'Your report about road blockage is pending review by the MDRRMO office.',
      status: 'pending',
    },
  ];

  for (const n of notifications) {
    await db.query(
      `INSERT INTO notifications (user_id, report_id, title, text, status)
       VALUES (?, ?, ?, ?, ?)`,
      [n.user_id, n.report_id, n.title, n.text, n.status]
    );
  }
  console.log(`  [OK] Seeded ${notifications.length} notifications`);
}

/**
 * Seeds emergency hotlines into the database.
 * @returns {Promise<void>}
 */
async function seedHotlines() {
  for (const h of HOTLINES) {
    await db.query(
      `INSERT INTO emergency_hotlines (category, label, number, sort_order)
       VALUES (?, ?, ?, ?)`,
      [h.category, h.label, h.number, h.sort_order]
    );
  }
  console.log(`  [OK] Seeded ${HOTLINES.length} emergency hotlines`);
}

/* --------------------------------------------------------------------------
 * 4. Main Entry Point
 * -------------------------------------------------------------------------- */

async function main() {
  try {
    await db.initialize();
    console.log(`[Seed] Seeding database in ${config.appMode} mode...\n`);

    await seedUsers();
    await seedReports();
    await seedHazards();
    await seedNotifications();
    await seedHotlines();

    console.log('\n[Seed] Database seeded successfully.');
  } catch (err) {
    console.error('[Seed] Error:', err.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();
