import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requireCompany } from '../middlewares/tenant';
import { requireRole } from '../middlewares/rbac';
import * as c from '../controllers/billController';
import * as ac from '../controllers/billAttachmentController';
import { billUpload } from '../middlewares/upload';

const router = Router();
router.use(authenticate, requireCompany);

router.get('/', c.getBills);
router.get('/:id', c.getBill);
router.post('/', requireRole('staff'), c.addBill);
router.put('/:id', requireRole('staff'), c.editBill);
router.post('/:id/approve', requireRole('accountant'), c.markApproved);
router.post('/:id/payments', requireRole('accountant'), c.addPayment);
router.delete('/:id', requireRole('accountant'), c.deleteBill);

// Attachments
router.post('/:id/attachments', requireRole('staff'), billUpload.single('file'), ac.uploadAttachment);
router.get('/:id/attachments', ac.getAttachments);
router.delete('/:id/attachments/:attachmentId', requireRole('staff'), ac.deleteAttachment);

export default router;
