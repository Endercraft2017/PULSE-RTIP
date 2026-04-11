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
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`[Migrate] Running ${files.length} migration(s) in ${config.appMode} mode...\n`);

  for (const file of files) {
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
        await db.query(statement);
      } catch (err) {
        if (err.message && err.message.includes('already exists')) {
          continue;
        }
        throw err;
      }
    }

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
