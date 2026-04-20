/**
 * =============================================================================
 * Admin Request Controller
 * =============================================================================
 * Approve/reject pending admin account requests.
 * =============================================================================
 */

const User = require('../models/User');
const Notification = require('../models/Notification');
const textbee = require('../services/sms/textbee');

async function list(req, res, next) {
  try {
    const requests = await User.findPendingAdminRequests();
    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
}

async function approve(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (user.admin_request_status !== 'pending') {
      return res.status(400).json({ success: false, message: 'No pending admin request for this user.' });
    }

    await User.updateAdminRequest(id, 'approved', { role: 'admin' });
    await Notification.deleteByTypeAndActor('admin_request', id);
    await Notification.create({
      user_id: id,
      type: 'admin_request_approved',
      title: 'Admin access granted',
      text: 'Your admin account request has been approved. Log in again to access admin features.',
    });

    // Best-effort SMS notification — don't fail the request if it errors
    let smsSent = false;
    if (user.phone && textbee.isConfigured()) {
      try {
        await textbee.sendSMS(
          user.phone,
          `PULSE 911: Hi ${user.name}, your MDRRMO admin account has been approved. Log in to access admin features. — Morong DRRMO`
        );
        smsSent = true;
      } catch (smsErr) {
        console.error('[admin-request approve] SMS send failed:', smsErr.message);
      }
    }

    res.json({ success: true, smsSent });
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
    if (user.admin_request_status !== 'pending') {
      return res.status(400).json({ success: false, message: 'No pending admin request for this user.' });
    }

    await User.updateAdminRequest(id, 'rejected');
    await Notification.deleteByTypeAndActor('admin_request', id);
    await Notification.create({
      user_id: id,
      type: 'admin_request_rejected',
      title: 'Admin access denied',
      text: 'Your admin account request was not approved. You can still use the app as a citizen.',
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, approve, reject };
