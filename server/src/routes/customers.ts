import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requireCompany } from '../middlewares/tenant';
import { requireRole } from '../middlewares/rbac';
import * as c from '../controllers/customerController';

const router = Router();
router.use(authenticate, requireCompany);

router.get('/', c.getCustomers);
router.get('/:id', c.getCustomer);
router.post('/', requireRole('staff'), c.addCustomer);
router.put('/:id', requireRole('staff'), c.editCustomer);
router.delete('/:id', requireRole('accountant'), c.removeCustomer);

export default router;
