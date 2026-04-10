import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';
import {
  findAccountTypes,
  findAccountsByCompany,
  findAccountById,
  createAccount,
  updateAccount,
  softDeleteAccount,
} from '../repositories/accountRepository';

const createSchema = z.object({
  accountTypeId: z.number().int().positive(),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  parentId: z.number().int().positive().optional(),
});

const updateSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  parentId: z.number().int().positive().nullable().optional(),
});

// GET /api/accounts/types
export async function getAccountTypes(req: Request, res: Response, next: NextFunction) {
  try {
    const types = await findAccountTypes();
    res.json({ success: true, data: { types } });
  } catch (error) {
    next(error);
  }
}

// GET /api/accounts
export async function getAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    const accounts = await findAccountsByCompany(req.user!.companyId!);
    res.json({ success: true, data: { accounts } });
  } catch (error) {
    next(error);
  }
}

// GET /api/accounts/:id
export async function getAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const account = await findAccountById(id, req.user!.companyId!);
    if (!account) throw new AppError(404, 'Account not found', 'NOT_FOUND');
    res.json({ success: true, data: { account } });
  } catch (error) {
    next(error);
  }
}

// POST /api/accounts
export async function addAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createSchema.parse(req.body);
    const id = await createAccount({ companyId: req.user!.companyId!, ...data });
    const account = await findAccountById(id, req.user!.companyId!);
    res.status(201).json({ success: true, data: { account } });
  } catch (error) {
    next(error);
  }
}

// PUT /api/accounts/:id
export async function editAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const companyId = req.user!.companyId!;
    const existing = await findAccountById(id, companyId);
    if (!existing) throw new AppError(404, 'Account not found', 'NOT_FOUND');

    const data = updateSchema.parse(req.body);
    await updateAccount(id, companyId, data as any);
    const updated = await findAccountById(id, companyId);
    res.json({ success: true, data: { account: updated } });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/accounts/:id
export async function removeAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const companyId = req.user!.companyId!;
    const existing = await findAccountById(id, companyId);
    if (!existing) throw new AppError(404, 'Account not found', 'NOT_FOUND');
    if (existing.isSystem) throw new AppError(400, 'System accounts cannot be deleted', 'SYSTEM_ACCOUNT');

    await softDeleteAccount(id, companyId);
    res.json({ success: true, message: 'Account deleted.' });
  } catch (error) {
    next(error);
  }
}
