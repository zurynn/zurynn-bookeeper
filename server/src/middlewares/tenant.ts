import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export function requireCompany(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.companyId) {
    return next(new AppError(403, 'No company associated with this account. Please create or join a company first.', 'NO_COMPANY'));
  }
  next();
}
