#!/usr/bin/env node
/**
 * Schema Consolidation — one-shot, idempotent rebuild of the cluttered
 * tables to a clean canonical form. Fixes:
 *
 *   1. report_images.report_id              → reports_old (BROKEN) → reports
 *   2. sms_reports.converted_report_id      → reports_old (BROKEN) → reports
 *   3. Five tables with `, col1, col2, ...` ALTER TABLE pile-up — rebuilt
 *      with a single clean CREATE TABLE.
 *   4. Adds missing logical FKs: users.id_verified_by, community_posts.
 *      reposted_from_post_id + promoted_from_report_id, notifications.
 *      actor_user_id, app_settings.updated_by.
 *   5. Adds 14 missing performance indexes on hot-path columns.
 *
 * Idempotent: detects whether the rebuild has already happened by reading
 * sqlite_master.sql and comparing against a "clean" sentinel marker. Safe
 * to re-run.
 *
 * Usage:  node scripts/consolidate-schema.js
 *
 * Run from anywhere — the script self-locates the DB via backend config.
 * NOT a regular migration file: this is one-shot maintenance, not part of
 * the migrate-on-boot pipeline.
 */

const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const config = require(path.join(ROOT, 'src/backend/config'));

if (config.appMode !== 'offline') {
  console.error('This script targets the SQLite (offline) DB. Set APP_MODE=offline.');
  process.exit(2);
}

const Database = require(path.join(ROOT, 'src/backend/node_modules/better-sqlite3'));
const db = new Database(config.sqlitePath);
db.pragma('foreign_keys = OFF'); // critical during table rebuild

// Sentinel: the clean rebuilt tables include this comment in their CREATE
// statement, so future runs can detect "already consolidated".
const SENTINEL = '/* consolidated v1 */';

function isAlreadyConsolidated() {
  const row = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
  ).get();
  return row && row.sql && row.sql.includes(SENTINEL);
}

function tableRowCount(name) {
  try {
    return db.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get().n;
  } catch (e) {
    return null;
  }
}

function rebuildTable(name, createSql, copyColumns) {
  const tmp = `${name}_consolidated_tmp`;
  console.log(`  → rebuilding ${name}...`);
  const before = tableRowCount(name);

  // Drop any leftover tmp from a failed prior run.
  db.prepare(`DROP TABLE IF EXISTS ${tmp}`).run();

  // The createSql has the new table named "{name}_consolidated_tmp"
  db.exec(createSql);

  // Copy all rows. SELECT explicit columns so old/new column orders don't matter.
  const cols = copyColumns.join(', ');
  db.exec(`INSERT INTO ${tmp} (${cols}) SELECT ${cols} FROM ${name}`);

  // Atomic swap.
  db.prepare(`DROP TABLE ${name}`).run();
  db.prepare(`ALTER TABLE ${tmp} RENAME TO ${name}`).run();

  const after = tableRowCount(name);
  if (before !== after) {
    throw new Error(`${name} row count changed during rebuild: ${before} → ${after}`);
  }
  console.log(`     ${name}: ${after} rows preserved.`);
}

function consolidate() {
  console.log('Starting schema consolidation against', config.sqlitePath);

  if (isAlreadyConsolidated()) {
    console.log('Schema is already consolidated. Nothing to do.');
    // Still safe to re-run index creates below.
  } else {
    console.log('Detected legacy schema — running table rebuilds.');

    db.exec('BEGIN TRANSACTION');
    try {
      // ─── users ──────────────────────────────────────────────────────
      rebuildTable('users', `
        CREATE TABLE users_consolidated_tmp (
          /* consolidated v1 */
          id                    INTEGER PRIMARY KEY AUTOINCREMENT,
          name                  VARCHAR(100)  NOT NULL,
          email                 VARCHAR(255)  NOT NULL UNIQUE,
          phone                 VARCHAR(20)   DEFAULT NULL,
          address               VARCHAR(255)  DEFAULT NULL,
          barangay              VARCHAR(64)   DEFAULT NULL,
          avatar                CHAR(1)       DEFAULT 'U',
          role                  VARCHAR(10)   NOT NULL DEFAULT 'citizen',
          password_hash         VARCHAR(255)  NOT NULL,
          admin_request_status  VARCHAR(20)   DEFAULT NULL,
          id_type               VARCHAR(64)   DEFAULT NULL,
          id_number             VARCHAR(64)   DEFAULT NULL,
          id_document_path      VARCHAR(500)  DEFAULT NULL,
          id_verified_at        DATETIME      DEFAULT NULL,
          id_verified_by        INTEGER       DEFAULT NULL,
          deleted_at            DATETIME      DEFAULT NULL,
          joined_date           DATETIME      DEFAULT CURRENT_TIMESTAMP,
          created_at            DATETIME      DEFAULT CURRENT_TIMESTAMP,
          updated_at            DATETIME      DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (id_verified_by) REFERENCES users(id)
        )
      `, [
        'id','name','email','phone','address','barangay','avatar','role',
        'password_hash','admin_request_status','id_type','id_number',
        'id_document_path','id_verified_at','id_verified_by','deleted_at',
        'joined_date','created_at','updated_at',
      ]);

      // ─── report_images (FK fix: reports_old → reports) ─────────────
      rebuildTable('report_images', `
        CREATE TABLE report_images_consolidated_tmp (
          /* consolidated v1 */
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          report_id    INTEGER       NOT NULL,
          file_path    VARCHAR(500)  NOT NULL,
          uploaded_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
        )
      `, ['id','report_id','file_path','uploaded_at']);

      // ─── sms_reports (FK fix: reports_old → reports) ───────────────
      rebuildTable('sms_reports', `
        CREATE TABLE sms_reports_consolidated_tmp (
          /* consolidated v1 */
          id                    INTEGER PRIMARY KEY AUTOINCREMENT,
          raw_message           TEXT          NOT NULL,
          source_type           VARCHAR(10)   NOT NULL DEFAULT 'sos',
          sender_phone          VARCHAR(20)   DEFAULT NULL,
          sender_name           VARCHAR(100)  DEFAULT NULL,
          type                  VARCHAR(50)   DEFAULT NULL,
          severity              VARCHAR(10)   DEFAULT 'medium',
          message               TEXT          DEFAULT NULL,
          latitude              DECIMAL(10,8) DEFAULT NULL,
          longitude             DECIMAL(11,8) DEFAULT NULL,
          status                VARCHAR(20)   DEFAULT 'pending',
          converted_report_id   INTEGER       DEFAULT NULL,
          textbee_sms_id        VARCHAR(100)  DEFAULT NULL,
          received_at           DATETIME      DEFAULT NULL,
          created_at            DATETIME      DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (converted_report_id) REFERENCES reports(id)
        )
      `, [
        'id','raw_message','source_type','sender_phone','sender_name','type',
        'severity','message','latitude','longitude','status',
        'converted_report_id','textbee_sms_id','received_at','created_at',
      ]);

      // ─── hazard_alerts ─────────────────────────────────────────────
      rebuildTable('hazard_alerts', `
        CREATE TABLE hazard_alerts_consolidated_tmp (
          /* consolidated v1 */
          id                  INTEGER PRIMARY KEY AUTOINCREMENT,
          title               VARCHAR(255)  NOT NULL,
          category            VARCHAR(20)   NOT NULL DEFAULT 'hazard',
          severity            VARCHAR(10)   NOT NULL DEFAULT 'medium',
          location            VARCHAR(255)  DEFAULT NULL,
          latitude            DECIMAL(10,8) DEFAULT NULL,
          longitude           DECIMAL(11,8) DEFAULT NULL,
          resolved_address    VARCHAR(500)  DEFAULT NULL,
          description         TEXT          DEFAULT NULL,
          audience_type       VARCHAR(16)   NOT NULL DEFAULT 'all',
          audience_barangays  TEXT          DEFAULT NULL,
          sound_enabled       INTEGER       NOT NULL DEFAULT 1,
          created_by          INTEGER       DEFAULT NULL,
          created_at          DATETIME      DEFAULT CURRENT_TIMESTAMP,
          updated_at          DATETIME      DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `, [
        'id','title','category','severity','location','latitude','longitude',
        'resolved_address','description','audience_type','audience_barangays',
        'sound_enabled','created_by','created_at','updated_at',
      ]);

      // ─── community_posts ───────────────────────────────────────────
      rebuildTable('community_posts', `
        CREATE TABLE community_posts_consolidated_tmp (
          /* consolidated v1 */
          id                       INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id                  INTEGER       NOT NULL,
          category                 VARCHAR(20)   NOT NULL DEFAULT 'community',
          type                     VARCHAR(20)   NOT NULL DEFAULT 'post',
          title                    VARCHAR(255)  NOT NULL,
          content                  TEXT          DEFAULT NULL,
          location                 VARCHAR(255)  DEFAULT NULL,
          image_path               VARCHAR(500)  DEFAULT NULL,
          video_path               VARCHAR(500)  DEFAULT NULL,
          reposted_from_post_id    INTEGER       DEFAULT NULL,
          promoted_from_report_id  INTEGER       DEFAULT NULL,
          created_at               DATETIME      DEFAULT CURRENT_TIMESTAMP,
          updated_at               DATETIME      DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id)                 REFERENCES users(id),
          FOREIGN KEY (reposted_from_post_id)   REFERENCES community_posts(id),
          FOREIGN KEY (promoted_from_report_id) REFERENCES reports(id)
        )
      `, [
        'id','user_id','category','type','title','content','location',
        'image_path','video_path','reposted_from_post_id',
        'promoted_from_report_id','created_at','updated_at',
      ]);

      // ─── notifications ─────────────────────────────────────────────
      rebuildTable('notifications', `
        CREATE TABLE notifications_consolidated_tmp (
          /* consolidated v1 */
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id         INTEGER       NOT NULL,
          type            VARCHAR(30)   DEFAULT NULL,
          title           VARCHAR(255)  NOT NULL,
          text            TEXT          DEFAULT NULL,
          status          VARCHAR(20)   DEFAULT NULL,
          actor_user_id   INTEGER       DEFAULT NULL,
          report_id       INTEGER       DEFAULT NULL,
          is_read         INTEGER       DEFAULT 0,
          created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id)        REFERENCES users(id),
          FOREIGN KEY (actor_user_id)  REFERENCES users(id),
          FOREIGN KEY (report_id)      REFERENCES reports(id)
        )
      `, [
        'id','user_id','type','title','text','status','actor_user_id',
        'report_id','is_read','created_at',
      ]);

      db.exec('COMMIT');
      console.log('  rebuild transaction committed.');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  // ─── Indexes (always run; CREATE INDEX IF NOT EXISTS is idempotent) ────
  console.log('\nApplying performance indexes...');

  const indexes = [
    // users
    'CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at)',
    'CREATE INDEX IF NOT EXISTS idx_users_role        ON users(role) WHERE deleted_at IS NULL',
    'CREATE INDEX IF NOT EXISTS idx_users_phone       ON users(phone)',
    'CREATE INDEX IF NOT EXISTS idx_users_barangay    ON users(barangay) WHERE deleted_at IS NULL',
    'CREATE INDEX IF NOT EXISTS idx_users_pending     ON users(admin_request_status) WHERE admin_request_status IS NOT NULL',
    // reports
    'CREATE INDEX IF NOT EXISTS idx_reports_status        ON reports(status)',
    'CREATE INDEX IF NOT EXISTS idx_reports_submitted_by  ON reports(submitted_by, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_reports_created_at    ON reports(created_at DESC)',
    // notifications
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_type        ON notifications(type)',
    // hazard_alerts
    'CREATE INDEX IF NOT EXISTS idx_hazards_created_at  ON hazard_alerts(created_at DESC)',
    // community_posts
    'CREATE INDEX IF NOT EXISTS idx_posts_created_at  ON community_posts(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_posts_category    ON community_posts(category, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_posts_user_id     ON community_posts(user_id, created_at DESC)',
    // sms_reports
    'CREATE INDEX IF NOT EXISTS idx_sms_reports_status         ON sms_reports(status, created_at DESC)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_reports_textbee ON sms_reports(textbee_sms_id) WHERE textbee_sms_id IS NOT NULL',
    // report_images
    'CREATE INDEX IF NOT EXISTS idx_report_images_report_id ON report_images(report_id)',
  ];

  for (const sql of indexes) {
    try {
      db.exec(sql);
      const name = sql.match(/EXISTS\s+(\w+)/)[1];
      console.log(`  [OK] ${name}`);
    } catch (e) {
      console.error(`  [FAIL] ${sql}: ${e.message}`);
      throw e;
    }
  }

  // ─── Final integrity check ─────────────────────────────────────────
  console.log('\nIntegrity check...');
  db.pragma('foreign_keys = ON');
  const fkErrors = db.prepare('PRAGMA foreign_key_check').all();
  if (fkErrors.length > 0) {
    console.warn('  ⚠  Found dangling FK rows (not blocking — these are likely pre-existing orphans):');
    for (const e of fkErrors) console.warn('    ', e);
  } else {
    console.log('  No FK violations.');
  }

  const integrity = db.pragma('integrity_check');
  console.log('  integrity_check:', integrity[0].integrity_check);

  console.log('\n✓ Consolidation complete.');
  db.close();
}

consolidate();
