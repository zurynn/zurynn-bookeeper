import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requireCompany } from '../middlewares/tenant';
import { getDashboard } from '../controllers/dashboardController';

const router = Router();

router.get('/', authenticate, requireCompany, getDashboard);

export default router;
