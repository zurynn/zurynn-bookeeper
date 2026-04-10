import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';
import {
  listCustomers, findCustomerById, createCustomer,
  updateCustomer, softDeleteCustomer, getCustomerInvoiceSummary,
} from '../repositories/customerRepository';

const schema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().optional(),
});

export async function getCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const list = await listCustomers(req.user!.companyId!);
    res.json({ success: true, data: { customers: list } });
  } catch (e) { next(e); }
}

export async function getCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const customer = await findCustomerById(id, req.user!.companyId!);
    if (!customer) throw new AppError(404, 'Customer not found', 'NOT_FOUND');
    const summary = await getCustomerInvoiceSummary(id, req.user!.companyId!);
    res.json({ success: true, data: { customer, summary } });
  } catch (e) { next(e); }
}

export async function addCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const data = schema.parse(req.body);
    const id = await createCustomer({ companyId: req.user!.companyId!, ...data });
    const customer = await findCustomerById(id, req.user!.companyId!);
    res.status(201).json({ success: true, data: { customer } });
  } catch (e) { next(e); }
}

export async function editCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const companyId = req.user!.companyId!;
    if (!(await findCustomerById(id, companyId))) throw new AppError(404, 'Customer not found', 'NOT_FOUND');
    const data = schema.partial().parse(req.body);
    await updateCustomer(id, companyId, data as any);
    res.json({ success: true, data: { customer: await findCustomerById(id, companyId) } });
  } catch (e) { next(e); }
}

export async function removeCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const companyId = req.user!.companyId!;
    if (!(await findCustomerById(id, companyId))) throw new AppError(404, 'Customer not found', 'NOT_FOUND');
    await softDeleteCustomer(id, companyId);
    res.json({ success: true, message: 'Customer deleted.' });
  } catch (e) { next(e); }
}
