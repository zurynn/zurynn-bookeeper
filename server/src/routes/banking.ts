import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requireCompany } from '../middlewares/tenant';
import { requireRole } from '../middlewares/rbac';
import * as ctrl from '../controllers/bankingController';

const router = Router();
const auth = [authenticate, requireCompany] as const;

// Bank accounts
router.get('/', ...auth, ctrl.getBankAccounts);
router.post('/', ...auth, requireRole('accountant'), ctrl.createBankAccount);
router.put('/:id', ...auth, requireRole('accountant'), ctrl.updateBankAccount);
router.delete('/:id', ...auth, requireRole('admin'), ctrl.deleteBankAccount);

// Transactions (nested under bank account)
router.get('/:id/transactions', ...auth, ctrl.getTransactions);
router.post('/:id/transactions', ...auth, requireRole('accountant'), ctrl.addTransaction);
router.post('/:id/transactions/import', ...auth, requireRole('accountant'), ctrl.importTransactions);
router.put('/:id/transactions/:txId/match', ...auth, requireRole('accountant'), ctrl.matchTx);
router.delete('/:id/transactions/:txId/match', ...auth, requireRole('accountant'), ctrl.unmatchTx);

// Reconciliation
router.get('/:id/reconciliations', ...auth, ctrl.getReconciliations);
router.get('/:id/reconciliations/open', ...auth, ctrl.getOpenRecon);
router.post('/:id/reconciliations', ...auth, requireRole('accountant'), ctrl.startRecon);
router.post('/:id/reconciliations/:reconId/close', ...auth, requireRole('accountant'), ctrl.closeRecon);

export default router;
