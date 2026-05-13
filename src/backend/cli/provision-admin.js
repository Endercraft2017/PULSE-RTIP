/**
 * =============================================================================
 * provision-admin CLI
 * =============================================================================
 * Developer-only tool for minting an MDRRMO admin account directly, bypassing
 * the signup + approval flow. The app no longer offers admin self-signup
 * (U-10), so all new admins must be provisioned here by a system operator.
 *
 * Usage:
 *   npm run provision-admin -- \
 *       --email "jane@mdrrmo.gov" \
 *       --name "Jane Doe" \
 *       --phone "09171234567" \
 *       --password "TempPass123!" \
 *       [--barangay "Poblacion"]
 *
 * Notes:
 * - Password is bcrypt-hashed at 10 rounds (matches the register path).
 * - Role is set to 'admin' with admin_request_status='approved'.
 * - id_verified_at is stamped now so the account isn't tripped up by the
 *   ID-verification gate.
 * - Barangay is optional for admins (most work out of the municipal office).
 * - Fails loudly if the email already exists — operators should not be
 *   accidentally re-provisioning live accounts.
 * =============================================================================
 */

const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('../config');
const db = require('../config/database');

/* --------------------------------------------------------------------------
 * Arg parsing — deliberately minimal. We don't pull in yargs/commander;
 * a handful of --flag "value" pairs is easy enough to parse by hand.
 * -------------------------------------------------------------------------- */
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function usage() {
  console.log('');
  console.log('Usage:');
  console.log('  node src/backend/cli/provision-admin.js \\');
  console.log('      --email "jane@mdrrmo.gov" \\');
  console.log('      --name "Jane Doe" \\');
  console.log('      --phone "09171234567" \\');
  console.log('      --password "TempPass123!" \\');
  console.log('      [--barangay "Poblacion"]');
  console.log('');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const email = (args.email || '').trim().toLowerCase();
  const name = (args.name || '').trim();
  const phone = (args.phone || '').trim();
  const password = args.password || '';
  const barangay = (args.barangay || '').trim() || null;

  if (!email || !name || !phone || !password) {
    console.error('[provision-admin] ERROR: --email, --name, --phone, and --password are all required.');
    usage();
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('[provision-admin] ERROR: password must be at least 8 characters.');
    process.exit(1);
  }

  await db.initialize();

  try {
    // Check for an existing row — including soft-deleted, because reviving
    // a tombstoned row under the same email would be surprising behavior.
    const existing = await db.query(
      'SELECT id, role, deleted_at FROM users WHERE email = ?',
      [email]
    );
    if (existing && existing[0]) {
      const row = existing[0];
      const state = row.deleted_at ? 'soft-deleted' : `active (role=${row.role})`;
      console.error(`[provision-admin] ERROR: an account already exists for ${email} (${state}, id=${row.id}).`);
      console.error('  Refusing to clobber. If this is intentional, update the account via the admin UI or DB directly.');
      process.exit(2);
    }

    const avatar = name.charAt(0).toUpperCase();
    const password_hash = await bcrypt.hash(password, 10);

    // Straight INSERT — we bypass User.create() because that helper doesn't
    // expose id_verified_at, and we want the admin pre-verified.
    const result = await db.query(
      `INSERT INTO users (
         name, email, phone, address, barangay, avatar,
         role, password_hash, admin_request_status,
         id_verified_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        name, email, phone, null, barangay, avatar,
        'admin', password_hash, 'approved',
      ]
    );

    const insertId = result.insertId || result.lastInsertRowid;

    console.log('');
    console.log('[provision-admin] Admin account created successfully.');
    console.log('  id       :', insertId);
    console.log('  name     :', name);
    console.log('  email    :', email);
    console.log('  phone    :', phone);
    console.log('  barangay :', barangay || '(none — admins often work out of the municipal office)');
    console.log('  role     : admin');
    console.log('  status   : approved (can log in immediately)');
    console.log('');
    console.log('  Temporary password:', password);
    console.log('');
    console.log('  REMINDER: instruct the new admin to change their password on first login.');
    console.log('');
  } catch (err) {
    console.error('[provision-admin] FAILED:', err.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();
