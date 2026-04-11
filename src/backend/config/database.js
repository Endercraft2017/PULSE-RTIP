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
  if (config.appMode === 'production') {
    if (!mysqlPool) initMySQL();
    const [rows] = await mysqlPool.execute(sql, params);
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
  query,
  initialize,
  close,
  getSQLiteDb,
};
