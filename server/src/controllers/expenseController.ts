import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';
import {
  listExpenses,
  findExpenseWithLines,
  createExpense,
  updateExpense,
  softDeleteExpense,
  listExpenseAttachments,
  createExpenseAttachment,
  findExpenseAttachment,
  deleteExpenseAttachment,
} from '../repositories/expenseRepository';
import { postExpense, voidExpense } from '../services/expenseService';

const UPLOAD_DIR = path.join(__dirname, '../../uploads/expenses');

// ─── Validation schemas ────────────────────────────────────────────────────────

const lineSchema = z.object({
  expenseAccountId: z.number().int().positive(),
  description: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  taxCodeId: z.number().int().positive().nullable().optional(),
  taxAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0.00'),
});

const createSchema = z.object({
  vendorId: z.number().int().positive().nullable().optional(),
  paymentAccountId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(500),
  notes: z.string().max(1000).optional(),
  lines: z.array(lineSchema).min(1, 'At least one line item required'),
});

// ─── Expense handlers ──────────────────────────────────────────────────────────

export async function getExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const result = await listExpenses(req.user!.companyId!, page);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
}

export async function getExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const expense = await findExpenseWithLines(id, req.user!.companyId!);
    if (!expense) throw new AppError(404, 'Expense not found', 'NOT_FOUND');
    res.json({ success: true, data: { expense } });
  } catch (e) { next(e); }
}

export async function addExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const { lines, ...data } = createSchema.parse(req.body);
    const id = await createExpense(req.user!.companyId!, req.user!.userId, data, lines);
    const expense = await findExpenseWithLines(id, req.user!.companyId!);
    res.status(201).json({ success: true, data: { expense } });
  } catch (e) { next(e); }
}

export async function editExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const companyId = req.user!.companyId!;

    const existing = await findExpenseWithLines(id, companyId);
    if (!existing) throw new AppError(404, 'Expense not found', 'NOT_FOUND');
    if (existing.status !== 'draft') throw new AppError(400, 'Only draft expenses can be edited', 'NOT_DRAFT');

    const { lines, ...data } = createSchema.partial().parse(req.body);
    await updateExpense(id, companyId, data as any, lines);
    const expense = await findExpenseWithLines(id, companyId);
    res.json({ success: true, data: { expense } });
  } catch (e) { next(e); }
}

export async function markPosted(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    await postExpense(id, req.user!.companyId!, req.user!.userId);
    res.json({ success: true, message: 'Expense posted.' });
  } catch (e) { next(e); }
}

export async function markVoided(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    await voidExpense(id, req.user!.companyId!, req.user!.userId);
    res.json({ success: true, message: 'Expense voided.' });
  } catch (e) { next(e); }
}

export async function deleteExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const companyId = req.user!.companyId!;
    const existing = await findExpenseWithLines(id, companyId);
    if (!existing) throw new AppError(404, 'Expense not found', 'NOT_FOUND');
    if (existing.status !== 'draft') throw new AppError(400, 'Only draft expenses can be deleted', 'NOT_DRAFT');
    await softDeleteExpense(id, companyId);
    res.json({ success: true, message: 'Expense deleted.' });
  } catch (e) { next(e); }
}

// ─── Attachment handlers ───────────────────────────────────────────────────────

export async function uploadAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const expenseId = parseInt(req.params.id, 10);
    const companyId = req.user!.companyId!;

    if (!req.file) throw new AppError(400, 'No file uploaded', 'NO_FILE');

    const expense = await findExpenseWithLines(expenseId, companyId);
    if (!expense) {
      fs.unlink(req.file.path, () => {});
      throw new AppError(404, 'Expense not found', 'NOT_FOUND');
    }

    const attachmentId = await createExpenseAttachment({
      expenseId,
      companyId,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });

    res.status(201).json({
      success: true,
      data: {
        id: attachmentId,
        expenseId,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (e) { next(e); }
}

export async function getAttachments(req: Request, res: Response, next: NextFunction) {
  try {
    const expenseId = parseInt(req.params.id, 10);
    const companyId = req.user!.companyId!;
    const attachments = await listExpenseAttachments(expenseId, companyId);
    res.json({ success: true, data: { attachments } });
  } catch (e) { next(e); }
}

export async function deleteAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const attachmentId = parseInt(req.params.attachmentId, 10);
    const companyId = req.user!.companyId!;

    const attachment = await findExpenseAttachment(attachmentId, companyId);
    if (!attachment) throw new AppError(404, 'Attachment not found', 'NOT_FOUND');

    fs.unlink(path.join(UPLOAD_DIR, attachment.storedName), () => {});
    await deleteExpenseAttachment(attachmentId);

    res.json({ success: true });
  } catch (e) { next(e); }
}
