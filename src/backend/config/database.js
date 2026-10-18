/**
 * =============================================================================
 * PULSE-RTIP Database Configuration
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports & State
 * 2. MySQL Connection (Production)
 * 3. SQLite Connection (Offline)
 * 4. Unified Query Helper
 * 5. Connection Management
 * 6. Exports
 *
 * Provides a dual-database abstraction layer. In production mode, connects to
 * MySQL on the Kali server. In offline mode, uses a local SQLite database.
 * Both are accessed through a unified query() function.
 * =============================================================================
 */

const config = require('./index');

/* --------------------------------------------------------------------------
 * 1. Imports & State
 * -------------------------------------------------------------------------- */

let mysqlPool = null;
let sqliteDb = null;
const { AsyncLocalStorage } = require('node:async_hooks');
const transactionContext = new AsyncLocalStorage();
let sqliteQueue = Promise.resolve();
function exclusive(work) {
  const result = sqliteQueue.then(work, work);
  sqliteQueue = result.catch(() => {});
  return result;
}

// All queries within a transaction share one connection. SQLite work outside
// it waits, preventing another request from being committed or rolled back.
async function transaction(work) {
  if (transactionContext.getStore()) return work();
  if (config.appMode === 'production') {
    if (!mysqlPool) initMySQL();
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await transactionContext.run({ connection }, work);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }
  return exclusive(async () => {
    if (!sqliteDb) initSQLite();
    sqliteDb.exec('BEGIN IMMEDIATE');
    try {
      const result = await transactionContext.run({ sqlite: true }, work);
      sqliteDb.exec('COMMIT');
      return result;
    } catch (error) {
      sqliteDb.exec('ROLLBACK');
      throw error;
    }
  });
}

/* --------------------------------------------------------------------------
 * 2. MySQL Connection (Production)
 * -------------------------------------------------------------------------- */

/**
 * Initializes the MySQL connection pool.
 * @returns {object} MySQL connection pool
 */
function initMySQL() {
  const mysql = require('mysql2/promise');
  mysqlPool = mysql.createPool({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // DATETIME values round-trip as UTC strings so downstream parseDbDate()
    // gets the same shape it gets from SQLite. Without this, mysql2 returns
    // JS Date objects in the server's local TZ, which breaks expiry checks.
    dateStrings: true,
    timezone: 'Z',
  });
  mysqlPool.on('connection', connection => {
    connection.query("SET time_zone = '+00:00'");
  });
  return mysqlPool;
}

/* --------------------------------------------------------------------------
 * 3. SQLite Connection (Offline)
 * -------------------------------------------------------------------------- */

/**
 * Initializes the SQLite database connection.
 * @returns {object} SQLite database instance
 */
function initSQLite() {
  const Database = require('better-sqlite3');
  const fs = require('fs');
  const path = require('path');

  const dir = path.dirname(config.sqlitePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  sqliteDb = new Database(config.sqlitePath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');
  return sqliteDb;
}

/* --------------------------------------------------------------------------
 * 4. Unified Query Helper
 * -------------------------------------------------------------------------- */

/**
 * Executes a SQL query against the active database.
 *
 * For MySQL: Uses parameterized queries with ? placeholders.
 * For SQLite: Converts ? placeholders to work with better-sqlite3.
 *
 * @param {string} sql - SQL query string with ? placeholders
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results as an array of row objects
 */
async function query(sql, params = []) {
  const context = transactionContext.getStore();
  if (config.appMode !== 'production' && !context) {
    return exclusive(() => transactionContext.run({ sqlite: true }, () => query(sql, params)));
  }
  if (config.appMode === 'production') {
    if (!mysqlPool) initMySQL();
    const [rows] = await (context?.connection || mysqlPool).execute(sql, params.map(value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ? value.replace('T', ' ').replace('Z', '') : value));
    return rows;
  }

  if (!sqliteDb) initSQLite();
  const normalizedSql = sql.trim();
  const isSelect = /^SELECT/i.test(normalizedSql);

  if (isSelect) {
    return sqliteDb.prepare(normalizedSql).all(...params);
  }

  const result = sqliteDb.prepare(normalizedSql).run(...params);
  return {
    insertId: result.lastInsertRowid,
    affectedRows: result.changes,
  };
}

/* --------------------------------------------------------------------------
 * 5. Connection Management
 * -------------------------------------------------------------------------- */

/**
 * Initializes the database connection based on APP_MODE.
 * @returns {Promise<void>}
 */
async function initialize() {
  if (config.appMode === 'production') {
    initMySQL();
    console.log(`[DB] MySQL connected to ${config.mysql.host}:${config.mysql.port}/${config.mysql.database}`);
  } else {
    initSQLite();
    console.log(`[DB] SQLite database at ${config.sqlitePath}`);
  }
}

/**
 * Closes all database connections gracefully.
 * @returns {Promise<void>}
 */
async function close() {
  if (mysqlPool) {
    await mysqlPool.end();
    mysqlPool = null;
  }
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
}

/**
 * Returns the raw SQLite database instance (for migrations/seeds).
 * @returns {object|null}
 */
function getSQLiteDb() {
  if (!sqliteDb) initSQLite();
  return sqliteDb;
}

/* --------------------------------------------------------------------------
 * 6. Exports
 * -------------------------------------------------------------------------- */

module.exports = {
  transaction,
  query,
  initialize,
  close,
  getSQLiteDb,
};
