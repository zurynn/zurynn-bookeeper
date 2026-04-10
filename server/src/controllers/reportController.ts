import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as repo from '../repositories/reportRepository';

const dateRangeSchema = z.object({
  startDate: z.string().min(1, 'startDate required'),
  endDate: z.string().min(1, 'endDate required'),
});

const asOfSchema = z.object({
  asOfDate: z.string().min(1, 'asOfDate required'),
});

export async function getPnL(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId!;
    const { startDate, endDate } = dateRangeSchema.parse(req.query);
    const data = await repo.getPnL(companyId, startDate, endDate);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function getBalanceSheet(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId!;
    const { asOfDate } = asOfSchema.parse(req.query);
    const data = await repo.getBalanceSheet(companyId, asOfDate);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function getCashFlow(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId!;
    const { startDate, endDate } = dateRangeSchema.parse(req.query);
    const data = await repo.getCashFlow(companyId, startDate, endDate);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function getTaxSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId!;
    const { startDate, endDate } = dateRangeSchema.parse(req.query);
    const data = await repo.getTaxSummary(companyId, startDate, endDate);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}
