/**
 * =============================================================================
 * Push Token Routes
 * =============================================================================
 *
 * POST /api/push-tokens       - Register / refresh a device FCM token
 *                               (auth-optional: runs authenticate only when
 *                                a Bearer token is present, so unclaimed
 *                                pre-login devices can still register).
 * POST /api/push-tokens/claim - Attach an unclaimed token to the user
 *                               (authenticated).
 * =============================================================================
 */

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/pushController');

const router = Router();

router.post('/', (req, res, next) => {
  const hasAuth = (req.headers.authorization || '').startsWith('Bearer ');
  if (hasAuth) return authenticate(req, res, () => ctrl.register(req, res, next));
  return ctrl.register(req, res, next);
});

router.post('/claim', authenticate, ctrl.claim);

module.exports = router;
