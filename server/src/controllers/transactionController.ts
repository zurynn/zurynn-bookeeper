import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';
import {
  listTransactions,
  findTransactionById,
  createTransaction,
  deleteTransaction,
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
} from '../repositories/transactionRepository';

const incomeCategories = Object.keys(INCOME_CATEGORIES) as [string, ...string[]];
const expenseCategories = Object.keys(EXPENSE_CATEGORIES) as [string, ...string[]];
const allCategories = [...incomeCategories, ...expenseCategories] as [string, ...string[]];

const createSchema = z.object({
  type: z.enum(['income', 'expense']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(255),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  category: z.enum(allCategories),
}).refine(
  (d) => d.type === 'income' ? incomeCategories.includes(d.category) : expenseCategories.includes(d.category),
  { message: 'Category does not match transaction type', path: ['category'] }
);

export async function getTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const result = await listTransactions(req.user!.companyId!, page);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
}

export async function getTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const tx = await findTransactionById(id, req.user!.companyId!);
    if (!tx) throw new AppError(404, 'Transaction not found', 'NOT_FOUND');
    res.json({ success: true, data: { transaction: tx } });
  } catch (e) { next(e); }
}

export async function addTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createSchema.parse(req.body);
    const id = await createTransaction({
      ...data,
      companyId: req.user!.companyId!,
      createdBy: req.user!.userId,
    });
    const tx = await findTransactionById(id, req.user!.companyId!);
    res.status(201).json({ success: true, data: { transaction: tx } });
  } catch (e) { next(e); }
}

export async function removeTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    await deleteTransaction(id, req.user!.companyId!);
    res.json({ success: true, message: 'Transaction deleted.' });
  } catch (e) { next(e); }
}

export function getCategories(_req: Request, res: Response) {
  res.json({
    success: true,
    data: {
      income: Object.keys(INCOME_CATEGORIES),
      expense: Object.keys(EXPENSE_CATEGORIES),
    },
  });
}
