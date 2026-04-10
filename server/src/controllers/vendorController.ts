import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';
import {
  listVendors, findVendorById, createVendor,
  updateVendor, softDeleteVendor,
} from '../repositories/vendorRepository';

const schema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  notes: z.string().optional(),
});

export async function getVendors(req: Request, res: Response, next: NextFunction) {
  try {
    const list = await listVendors(req.user!.companyId!);
    res.json({ success: true, data: { vendors: list } });
  } catch (e) { next(e); }
}

export async function getVendor(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const vendor = await findVendorById(id, req.user!.companyId!);
    if (!vendor) throw new AppError(404, 'Vendor not found', 'NOT_FOUND');
    res.json({ success: true, data: { vendor } });
  } catch (e) { next(e); }
}

export async function addVendor(req: Request, res: Response, next: NextFunction) {
  try {
    const data = schema.parse(req.body);
    const id = await createVendor({ companyId: req.user!.companyId!, ...data });
    const vendor = await findVendorById(id, req.user!.companyId!);
    res.status(201).json({ success: true, data: { vendor } });
  } catch (e) { next(e); }
}

export async function editVendor(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const companyId = req.user!.companyId!;
    if (!(await findVendorById(id, companyId))) throw new AppError(404, 'Vendor not found', 'NOT_FOUND');
    const data = schema.partial().parse(req.body);
    await updateVendor(id, companyId, data as any);
    res.json({ success: true, data: { vendor: await findVendorById(id, companyId) } });
  } catch (e) { next(e); }
}

export async function removeVendor(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const companyId = req.user!.companyId!;
    if (!(await findVendorById(id, companyId))) throw new AppError(404, 'Vendor not found', 'NOT_FOUND');
    await softDeleteVendor(id, companyId);
    res.json({ success: true, message: 'Vendor deleted.' });
  } catch (e) { next(e); }
}
