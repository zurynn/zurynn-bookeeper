import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection';
import { auditLogs } from '../db/schema/ledger';
import { logger } from '../utils/logger';

export function auditLog(action: string, entityType: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json.bind(res);
    const userId = req.user?.userId;
    const companyId = req.user?.companyId;

    res.json = function (data: any) {
      if (res.statusCode >= 200 && res.statusCode < 300 && userId && companyId) {
        const entityId = data?.data?.id || req.params.id;
        
        setImmediate(async () => {
          try {
            const db = getDb();
            await db.insert(auditLogs).values({
              companyId,
              userId,
              action,
              entityType,
              entityId: entityId ? String(entityId) : null,
              newValue: JSON.stringify(req.body),
              ipAddress: req.ip || req.socket?.remoteAddress || null,
            });
          } catch (error) {
            logger.error('Failed to write audit log', { error });
          }
        });
      }
      return originalJson(data);
    };

    next();
  };
}
