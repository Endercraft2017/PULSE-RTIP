/**
 * =============================================================================
 * Admin Request Controller
 * =============================================================================
 * Approve/reject pending account reviews — covers both admin-role upgrade
 * requests and plain citizen signups (every signup goes through here now).
 * =============================================================================
 */

const User = require('../models/User');
const Notification = require('../models/Notification');
const textbee = require('../services/sms/textbee');
const mailer = require('../services/email/mailer');
const { logAction } = require('../middleware/auditLog');

const PENDING_STATES = ['pending', 'pending_admin'];

async function list(req, res, next) {
  try {
    const requests = await User.findPendingApprovals();
    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
}

// Best-effort dispatch — never throws. SMS requires TextBee configured; email
// falls through to the mailer's dev-log mode when SMTP isn't set.
async function notifyOutcome(user, outcome) {
  const approved = outcome === 'approved';
  const wasAdminRequest = user.admin_request_status === 'pending_admin';

  const smsBody = approved
    ? (wasAdminRequest
        ? `PULSE 911: Hi ${user.name}, your MDRRMO admin account has been approved. Log in to access admin features. — Morong DRRMO`
        : `PULSE 911: Hi ${user.name}, your account has been approved. You can now log in. — Morong DRRMO`)
    : `PULSE 911: Hi ${user.name}, your account application was not approved. Contact MDRRMO Morong for details. — Morong DRRMO`;

  const emailSubject = approved
    ? (wasAdminRequest ? 'Your MDRRMO admin account is approved' : 'Your PULSE 911 account is approved')
    : 'Your PULSE 911 account application was not approved';
  const emailText = approved
    ? (wasAdminRequest
        ? `Hi ${user.name},\n\nYour MDRRMO admin account request has been approved. You can now log in at the PULSE 911 app to access admin features.\n\n— MDRRMO Morong, Rizal`
        : `Hi ${user.name},\n\nYour PULSE 911 account has been approved. You can now log in and start using the app.\n\n— MDRRMO Morong, Rizal`)
    : `Hi ${user.name},\n\nYour PULSE 911 account application was not approved at this time. If you believe this is a mistake, please contact MDRRMO Morong for details.\n\n— MDRRMO Morong, Rizal`;

  let smsSent = false;
  if (user.phone && textbee.isConfigured()) {
    try {
      // Approval notifications can tolerate a few seconds of backoff on
      // rate-limit, unlike OTPs which must fail fast.
      await textbee.sendSMSWithRetry(user.phone, smsBody);
      smsSent = true;
    } catch (smsErr) {
      console.error('[admin-request ' + outcome + '] SMS send failed:', smsErr.message);
    }
  }

  let emailSent = false;
  if (user.email) {
    try {
      const result = await mailer.send({ to: user.email, subject: emailSubject, text: emailText });
      emailSent = !!(result && result.success);
    } catch (mailErr) {
      console.error('[admin-request ' + outcome + '] email send failed:', mailErr.message);
    }
  }

  return { smsSent, emailSent };
}

async function approve(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (!PENDING_STATES.includes(user.admin_request_status)) {
      return res.status(400).json({ success: false, message: 'No pending review for this user.' });
    }

    // LEGACY: 'pending_admin' was the old admin-self-signup path. New signups
    // (post-U-10) never write that status — admins are now provisioned via
    // `npm run provision-admin`. We keep the promotion branch here so any
    // pre-existing 'pending_admin' rows in the DB can still be processed.
    const wasAdminRequest = user.admin_request_status === 'pending_admin';
    const updated = await User.updateAdminRequest(
      id,
      'approved',
      wasAdminRequest ? { role: 'admin' } : {}
    );
    // One action approves BOTH the account and the ID the user submitted.
    // Stamps id_verified_at + id_verified_by so we have an audit trail.
    if (req.user && req.user.id) {
      await User.setIdVerified(id, req.user.id);
    }
    await Notification.deleteByTypeAndActor('admin_request', id);

    const notifTitle = wasAdminRequest ? 'Admin access granted' : 'Account approved';
    const notifText = wasAdminRequest
      ? 'Your admin account request has been approved. Log in again to access admin features.'
      : 'Your account has been approved. You can now log in to PULSE 911.';
    await Notification.create({
      user_id: id,
      type: 'admin_request_approved',
      title: notifTitle,
      text: notifText,
    });

    // `user` still has the pre-update status — notifyOutcome reads it to
    // decide wording. Pass the original snapshot (not the updated row).
    const { smsSent, emailSent } = await notifyOutcome(user, 'approved');

    if (req.user && req.user.id) {
      logAction(req.user.id, 'user_approved', 'user', user.id, {
        name: user.name,
        email: user.email,
        kind: wasAdminRequest ? 'admin_request' : 'citizen_signup',
      });
    }

    res.json({ success: true, kind: wasAdminRequest ? 'admin_request' : 'citizen_signup', smsSent, emailSent });
  } catch (err) {
    next(err);
  }
}

async function reject(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (!PENDING_STATES.includes(user.admin_request_status)) {
      return res.status(400).json({ success: false, message: 'No pending review for this user.' });
    }

    const wasAdminRequest = user.admin_request_status === 'pending_admin';
    await User.updateAdminRequest(id, 'rejected');
    await Notification.deleteByTypeAndActor('admin_request', id);

    const notifTitle = wasAdminRequest ? 'Admin access denied' : 'Account not approved';
    const notifText = wasAdminRequest
      ? 'Your admin account request was not approved. You can still use the app as a citizen.'
      : 'Your account application was not approved. Contact MDRRMO Morong for details.';
    await Notification.create({
      user_id: id,
      type: 'admin_request_rejected',
      title: notifTitle,
      text: notifText,
    });

    const { smsSent, emailSent } = await notifyOutcome(user, 'rejected');

    if (req.user && req.user.id) {
      logAction(req.user.id, 'user_rejected', 'user', user.id, {
        name: user.name,
        email: user.email,
        kind: wasAdminRequest ? 'admin_request' : 'citizen_signup',
      });
    }

    res.json({ success: true, kind: wasAdminRequest ? 'admin_request' : 'citizen_signup', smsSent, emailSent });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, approve, reject };
