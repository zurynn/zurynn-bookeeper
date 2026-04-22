import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requireCompany } from '../middlewares/tenant';
import {
  getTransactions,
  getTransaction,
  addTransaction,
  removeTransaction,
  getCategories,
} from '../controllers/transactionController';

const router = Router();

router.use(authenticate, requireCompany);

router.get('/categories', getCategories);
router.get('/', getTransactions);
router.get('/:id', getTransaction);
router.post('/', addTransaction);
router.delete('/:id', removeTransaction);

export default router;
