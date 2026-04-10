import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';
import {
  findCompanyById,
  createCompany,
  updateCompany,
  addUserToCompany,
  findCompanyMembers,
  removeMemberFromCompany,
  findTaxSettings,
  createTaxSetting,
  updateTaxSetting,
  deleteTaxSetting,
  findUserCompany,
} from '../repositories/companyRepository';
import { seedDefaultAccounts } from '../repositories/accountRepository';
import { findUserByEmail } from '../repositories/userRepository';
import { signAccessToken } from '../utils/jwt';

const createCompanySchema = z.object({
  name: z.string().min(1).max(255),
  currency: z.string().length(3).default('USD'),
  fiscalYearStart: z.string().regex(/^\d{2}-\d{2}$/).default('01-01'),
  address: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  website: z.string().max(255).optional(),
  industry: z.string().max(100).optional(),
});

const updateCompanySchema = createCompanySchema.partial();

const taxSettingSchema = z.object({
  taxName: z.string().min(1).max(100),
  taxRate: z.string().regex(/^\d+(\.\d{1,4})?$/),
  appliesTo: z.enum(['sales', 'purchases', 'both']).default('both'),
  recoverablePercentage: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  recoverableAccountId: z.number().int().positive().nullable().optional(),
  liabilityAccountId: z.number().int().positive().nullable().optional(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'accountant', 'staff', 'readonly']).default('staff'),
});

// POST /api/companies — create company for a user who has none
export async function createMyCompany(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;

    const existing = await findUserCompany(userId);
    if (existing) {
      throw new AppError(409, 'You already belong to a company', 'COMPANY_EXISTS');
    }

    const data = createCompanySchema.parse(req.body);
    const companyId = await createCompany(data);
    await addUserToCompany({ companyId, userId, role: 'admin', acceptedAt: new Date() });
    await seedDefaultAccounts(companyId);

    const company = await findCompanyById(companyId);

    // Issue a new access token that includes the companyId
    const newAccessToken = signAccessToken({
      userId,
      email: req.user!.email,
      companyId,
    });

    res.status(201).json({
      success: true,
      data: { company, accessToken: newAccessToken },
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/companies/me
export async function getMyCompany(req: Request, res: Response, next: NextFunction) {
  try {
    const company = await findCompanyById(req.user!.companyId!);
    if (!company) throw new AppError(404, 'Company not found', 'NOT_FOUND');

    const taxSettingsList = await findTaxSettings(company.id);

    res.json({ success: true, data: { company, taxSettings: taxSettingsList } });
  } catch (error) {
    next(error);
  }
}

// PUT /api/companies/me
export async function updateMyCompany(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId!;
    const data = updateCompanySchema.parse(req.body);
    await updateCompany(companyId, data);
    const updated = await findCompanyById(companyId);
    res.json({ success: true, data: { company: updated } });
  } catch (error) {
    next(error);
  }
}

// GET /api/companies/me/members
export async function getCompanyMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const members = await findCompanyMembers(req.user!.companyId!);
    res.json({ success: true, data: { members } });
  } catch (error) {
    next(error);
  }
}

// POST /api/companies/me/invite
export async function inviteMember(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId!;
    const { email, role } = inviteSchema.parse(req.body);

    const invitee = await findUserByEmail(email);
    if (!invitee) {
      throw new AppError(404, 'No user found with that email address', 'USER_NOT_FOUND');
    }

    const existingMembers = await findCompanyMembers(companyId);
    const alreadyMember = existingMembers.some((m) => m.userId === invitee.id);
    if (alreadyMember) {
      throw new AppError(409, 'This user is already a member of your company', 'ALREADY_MEMBER');
    }

    await addUserToCompany({ companyId, userId: invitee.id, role, acceptedAt: new Date() });

    res.status(201).json({ success: true, message: `${email} has been added to your company.` });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/companies/me/members/:userId
export async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId!;
    const targetUserId = parseInt(req.params.userId, 10);

    if (targetUserId === req.user!.userId) {
      throw new AppError(400, 'You cannot remove yourself from the company', 'CANNOT_REMOVE_SELF');
    }

    await removeMemberFromCompany(companyId, targetUserId);
    res.json({ success: true, message: 'Member removed.' });
  } catch (error) {
    next(error);
  }
}

// GET /api/companies/me/tax-settings
export async function getTaxSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const list = await findTaxSettings(req.user!.companyId!);
    res.json({ success: true, data: { taxSettings: list } });
  } catch (error) {
    next(error);
  }
}

// POST /api/companies/me/tax-settings
export async function addTaxSetting(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId!;
    const data = taxSettingSchema.parse(req.body);
    const id = await createTaxSetting({ companyId, ...data });
    res.status(201).json({ success: true, data: { id } });
  } catch (error) {
    next(error);
  }
}

// PUT /api/companies/me/tax-settings/:id
export async function editTaxSetting(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId!;
    const id = parseInt(req.params.id, 10);
    const data = taxSettingSchema.partial().parse(req.body);
    await updateTaxSetting(id, companyId, data);
    res.json({ success: true, message: 'Tax setting updated.' });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/companies/me/tax-settings/:id
export async function removeTaxSetting(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId!;
    const id = parseInt(req.params.id, 10);
    await deleteTaxSetting(id, companyId);
    res.json({ success: true, message: 'Tax setting deleted.' });
  } catch (error) {
    next(error);
  }
}
