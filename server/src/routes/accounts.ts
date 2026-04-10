import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requireCompany } from '../middlewares/tenant';
import { requireRole } from '../middlewares/rbac';
import * as accountController from '../controllers/accountController';

const router = Router();

router.use(authenticate, requireCompany);

router.get('/types', accountController.getAccountTypes);
router.get('/', accountController.getAccounts);
router.get('/:id', accountController.getAccount);
router.post('/', requireRole('accountant'), accountController.addAccount);
router.put('/:id', requireRole('accountant'), accountController.editAccount);
router.delete('/:id', requireRole('admin'), accountController.removeAccount);

export default router;
