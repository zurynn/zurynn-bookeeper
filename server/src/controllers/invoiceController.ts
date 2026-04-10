import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';
import {
  listInvoices, findInvoiceWithItems, createInvoice,
  updateInvoice, sendInvoice, recordInvoicePayment, voidInvoice,
} from '../repositories/invoiceRepository';

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.string().regex(/^\d+(\.\d{1,2})?$/).default('1.00'),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  taxRate: z.string().regex(/^0(\.\d{1,4})?$/).default('0.0000'),
});

const createSchema = z.object({
  customerId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(itemSchema).min(1, 'At least one item required'),
});

const paymentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  method: z.enum(['bank', 'cash', 'check', 'credit_card', 'other']).default('bank'),
  reference: z.string().max(100).optional(),
  notes: z.string().optional(),
});

export async function getInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const result = await listInvoices(req.user!.companyId!, page);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
}

export async function getInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const invoice = await findInvoiceWithItems(id, req.user!.companyId!);
    if (!invoice) throw new AppError(404, 'Invoice not found', 'NOT_FOUND');
    res.json({ success: true, data: { invoice } });
  } catch (e) { next(e); }
}

export async function addInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { items, ...data } = createSchema.parse(req.body);
    const id = await createInvoice(req.user!.companyId!, data, items);
    const invoice = await findInvoiceWithItems(id, req.user!.companyId!);
    res.status(201).json({ success: true, data: { invoice } });
  } catch (e) { next(e); }
}

export async function editInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const companyId = req.user!.companyId!;
    const { items, ...data } = createSchema.partial().parse(req.body);
    await updateInvoice(id, companyId, data as any, items);
    res.json({ success: true, data: { invoice: await findInvoiceWithItems(id, companyId) } });
  } catch (e) { next(e); }
}

export async function markSent(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    await sendInvoice(id, req.user!.companyId!, req.user!.userId);
    res.json({ success: true, message: 'Invoice sent.' });
  } catch (e) { next(e); }
}

export async function addPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const data = paymentSchema.parse(req.body);
    await recordInvoicePayment(id, req.user!.companyId!, req.user!.userId, data);
    res.status(201).json({ success: true, message: 'Payment recorded.' });
  } catch (e) { next(e); }
}

export async function deleteInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    await voidInvoice(id, req.user!.companyId!);
    res.json({ success: true, message: 'Invoice voided.' });
  } catch (e) { next(e); }
}
