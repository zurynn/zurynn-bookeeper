import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requireCompany } from '../middlewares/tenant';
import { requireRole } from '../middlewares/rbac';
import * as c from '../controllers/expenseController';
import { expenseUpload } from '../middlewares/upload';

const router = Router();
router.use(authenticate, requireCompany);

router.get('/', c.getExpenses);
router.get('/:id', c.getExpense);
router.post('/', requireRole('staff'), c.addExpense);
router.put('/:id', requireRole('staff'), c.editExpense);
router.post('/:id/post', requireRole('accountant'), c.markPosted);
router.post('/:id/void', requireRole('accountant'), c.markVoided);
router.delete('/:id', requireRole('staff'), c.deleteExpense);

// Attachments
router.post('/:id/attachments', requireRole('staff'), expenseUpload.single('file'), c.uploadAttachment);
router.get('/:id/attachments', c.getAttachments);
router.delete('/:id/attachments/:attachmentId', requireRole('staff'), c.deleteAttachment);

export default router;
