import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requireCompany } from '../middlewares/tenant';
import { requireRole } from '../middlewares/rbac';
import * as c from '../controllers/vendorController';

const router = Router();
router.use(authenticate, requireCompany);

router.get('/', c.getVendors);
router.get('/:id', c.getVendor);
router.post('/', requireRole('staff'), c.addVendor);
router.put('/:id', requireRole('staff'), c.editVendor);
router.delete('/:id', requireRole('accountant'), c.removeVendor);

export default router;
