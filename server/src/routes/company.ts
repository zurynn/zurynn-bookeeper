import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requireCompany } from '../middlewares/tenant';
import { requireRole } from '../middlewares/rbac';
import * as companyController from '../controllers/companyController';

const router = Router();

// All company routes require auth
router.use(authenticate);

// Create a company (for users who don't have one yet)
router.post('/', companyController.createMyCompany);

// All routes below also require an existing company
router.get('/me', requireCompany, companyController.getMyCompany);
router.put('/me', requireCompany, requireRole('admin'), companyController.updateMyCompany);

// Team management
router.get('/me/members', requireCompany, companyController.getCompanyMembers);
router.post('/me/invite', requireCompany, requireRole('admin'), companyController.inviteMember);
router.delete('/me/members/:userId', requireCompany, requireRole('admin'), companyController.removeMember);

// Tax settings
router.get('/me/tax-settings', requireCompany, companyController.getTaxSettings);
router.post('/me/tax-settings', requireCompany, requireRole('admin'), companyController.addTaxSetting);
router.put('/me/tax-settings/:id', requireCompany, requireRole('admin'), companyController.editTaxSetting);
router.delete('/me/tax-settings/:id', requireCompany, requireRole('admin'), companyController.removeTaxSetting);

export default router;
