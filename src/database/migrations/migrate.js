/**
 * =============================================================================
 * PULSE-RTIP Database Migration Runner
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. Migration Execution
 * 3. Main Entry Point
 *
 * Reads all .sql files in the migrations directory (sorted by filename)
 * and executes them against the configured database.
 *
 * Usage: node src/database/migrations/migrate.js
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');
const backendDir = path.resolve(__dirname, '../../backend');
const config = require(path.join(backendDir, 'config'));
const db = require(path.join(backendDir, 'config/database'));

/* --------------------------------------------------------------------------
 * 2. Migration Execution
 * -------------------------------------------------------------------------- */

/**
 * Reads and executes all .sql migration files in order.
 * @returns {Promise<void>}
 */
async function runMigrations() {
  const migrationsDir = __dirname;
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && (!process.argv.includes('--upgrade-dispatch') || Number(f.slice(0, 3)) >= 31))
    .sort();

  console.log(`[Migrate] Running ${files.length} migration(s) in ${config.appMode} mode...\n`);

  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY)');
  for (const file of files) {
    const applied = await db.query('SELECT name FROM schema_migrations WHERE name = ?', [file]);
    if (applied.length) continue;
    if (config.appMode !== 'production' && file === '009_allow_null_submitted_by.sql') {
      const columns = db.getSQLiteDb().prepare('PRAGMA table_info(reports)').all();
      if (columns.some(column => column.name === 'source')) {
        await db.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
        continue;
      }
    }

    if(file==='035_append_only_history.sql') {
      for(const table of ['report_events','hazard_events','audit_log']) for(const action of ['UPDATE','DELETE']) {
        const name=`retain_${table}_${action.toLowerCase()}`;
        if(config.appMode==='production') {
          try{await db.query(`CREATE TRIGGER ${name} BEFORE ${action} ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'History is append-only'`);}catch(e){if(!/already exists/i.test(e.message))throw e;}
        }else db.getSQLiteDb().exec(`CREATE TRIGGER IF NOT EXISTS ${name} BEFORE ${action} ON ${table} BEGIN SELECT RAISE(ABORT, 'History is append-only'); END`);
      }
      await db.query('INSERT INTO schema_migrations (name) VALUES (?)',[file]);continue;
    }
    if (file === '032_archive_guards.sql') {
      for (const table of ['reports', 'hazard_alerts']) {
        if (config.appMode === 'production') {
          try {
            await db.query(`CREATE TRIGGER prevent_delete_${table} BEFORE DELETE ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Archive records instead of deleting'`);
          } catch (error) { if (!/already exists/i.test(error.message)) throw error; }
        } else {
          db.getSQLiteDb().exec(`CREATE TRIGGER IF NOT EXISTS prevent_delete_${table} BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT, 'Archive records instead of deleting'); END`);
        }
      }
      await db.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      continue;
    }
    if (file === '033_timestamp_precision.sql' && config.appMode === 'production') {
      for (const table of ['report_events', 'audit_log']) await db.query(`ALTER TABLE ${table} MODIFY created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)`);
      await db.query('ALTER TABLE reports MODIFY updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)');
    }
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    const cleaned = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleaned
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      try {
        const engineSQL = config.appMode === 'production' ? statement.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'INTEGER PRIMARY KEY AUTO_INCREMENT') : statement;
        await db.query(engineSQL);
      } catch (err) {
        const msg = (err.message || '').toLowerCase();
        // Idempotent re-runs: tolerate repeat CREATE / ALTER ADD COLUMN
        if (
          msg.includes('already exists') ||
          msg.includes('duplicate column') ||
          msg.includes('duplicate key name')
        ) {
          continue;
        }
        throw err;
      }
    }

    await db.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    console.log(`  [OK] ${file}`);
  }

  console.log('\n[Migrate] All migrations completed successfully.');
}

/* --------------------------------------------------------------------------
 * 3. Main Entry Point
 * -------------------------------------------------------------------------- */

async function main() {
  try {
    await db.initialize();
    await runMigrations();
  } catch (err) {
    console.error('[Migrate] Error:', err.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();
