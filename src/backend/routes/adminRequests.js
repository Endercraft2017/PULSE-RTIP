const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/adminRequestController');

const router = Router();

router.get('/', authenticate, requireAdmin, ctrl.list);
router.put('/:id/approve', authenticate, requireAdmin, ctrl.approve);
router.put('/:id/reject', authenticate, requireAdmin, ctrl.reject);

module.exports = router;
