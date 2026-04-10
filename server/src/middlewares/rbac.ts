import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { getDb } from '../db/connection';
import { companyUsers } from '../db/schema/company';
import { eq, and } from 'drizzle-orm';

export type Role = 'admin' | 'accountant' | 'staff' | 'readonly';

const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 4,
  accountant: 3,
  staff: 2,
  readonly: 1,
};

export function requireRole(minRole: Role) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
    }

    const companyId = req.user.companyId || parseInt(req.params.companyId || req.headers['x-company-id'] as string);

    if (!companyId) {
      return next(new AppError(400, 'Company context required', 'NO_COMPANY_CONTEXT'));
    }

    try {
      const db = getDb();
      const [membership] = await db
        .select()
        .from(companyUsers)
        .where(
          and(
            eq(companyUsers.companyId, companyId),
            eq(companyUsers.userId, req.user!.userId)
          )
        )
        .limit(1);

      if (!membership) {
        return next(new AppError(403, 'Access denied: not a member of this company', 'FORBIDDEN'));
      }

      const userRoleLevel = ROLE_HIERARCHY[membership.role as Role] || 0;
      const requiredLevel = ROLE_HIERARCHY[minRole];

      if (userRoleLevel < requiredLevel) {
        return next(new AppError(403, `Access denied: requires ${minRole} role or higher`, 'INSUFFICIENT_ROLE'));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
