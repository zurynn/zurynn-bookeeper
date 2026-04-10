import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requireCompany } from '../middlewares/tenant';
import { requireRole } from '../middlewares/rbac';
import * as journalController from '../controllers/journalController';

const router = Router();

router.use(authenticate, requireCompany);

router.get('/', journalController.getJournalEntries);
router.get('/:id', journalController.getJournalEntry);
router.post('/', requireRole('accountant'), journalController.createEntry);
router.put('/:id', requireRole('accountant'), journalController.updateEntry);
router.post('/:id/post', requireRole('accountant'), journalController.postEntry);
router.post('/:id/reverse', requireRole('accountant'), journalController.reverseEntry);
router.delete('/:id', requireRole('accountant'), journalController.removeEntry);

export default router;
