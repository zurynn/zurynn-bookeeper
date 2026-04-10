import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requireCompany } from '../middlewares/tenant';
import { requireRole } from '../middlewares/rbac';
import * as c from '../controllers/invoiceController';

const router = Router();
router.use(authenticate, requireCompany);

router.get('/', c.getInvoices);
router.get('/:id', c.getInvoice);
router.post('/', requireRole('staff'), c.addInvoice);
router.put('/:id', requireRole('staff'), c.editInvoice);
router.post('/:id/send', requireRole('staff'), c.markSent);
router.post('/:id/payments', requireRole('staff'), c.addPayment);
router.delete('/:id', requireRole('accountant'), c.deleteInvoice);

export default router;
