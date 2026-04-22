import { Request, Response, NextFunction } from 'express';
import { getPnL } from '../repositories/reportRepository';
import { getCashBalance, getRecentTransactions } from '../repositories/transactionRepository';

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId!;

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    const [pnl, cashBalance, recentTransactions] = await Promise.all([
      getPnL(companyId, monthStart, monthEnd),
      getCashBalance(companyId),
      getRecentTransactions(companyId, 10),
    ]);

    res.json({
      success: true,
      data: {
        period: { monthStart, monthEnd },
        kpis: {
          monthIncome: pnl.totalRevenue,
          monthExpenses: pnl.totalExpenses,
          monthNetIncome: pnl.netIncome,
          cashBalance,
        },
        recentTransactions,
      },
    });
  } catch (e) {
    next(e);
  }
}
