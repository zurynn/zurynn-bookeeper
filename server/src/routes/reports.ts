import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requireCompany } from '../middlewares/tenant';
import * as ctrl from '../controllers/reportController';

const router = Router();
const auth = [authenticate, requireCompany] as const;

router.get('/pnl', ...auth, ctrl.getPnL);
router.get('/balance-sheet', ...auth, ctrl.getBalanceSheet);
router.get('/cash-flow', ...auth, ctrl.getCashFlow);
router.get('/tax-summary', ...auth, ctrl.getTaxSummary);

export default router;
