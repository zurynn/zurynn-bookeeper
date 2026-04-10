import { Request, Response, NextFunction } from 'express';
import { eq, and, isNull, sql, or, desc } from 'drizzle-orm';
import { getDb } from '../db/connection';
import { customers, invoices } from '../db/schema/invoicing';
import { vendors, bills } from '../db/schema/billing';
import { bankAccounts } from '../db/schema/banking';
import { getPnL } from '../repositories/reportRepository';

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = req.user!.companyId!;
    const db = getDb();

    // Current month date range
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    // Run all queries in parallel
    const [pnl, arRow, apRow, cashRow, openInvoicesRow, openBillsRow, recentInvoices, recentBills] =
      await Promise.all([
        // Month P&L
        getPnL(companyId, monthStart, monthEnd),

        // Total AR (sum of customer balance_due)
        db
          .select({ total: sql<string>`COALESCE(SUM(${customers.balanceDue}), 0)` })
          .from(customers)
          .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt))),

        // Total AP (sum of vendor balance_owed)
        db
          .select({ total: sql<string>`COALESCE(SUM(${vendors.balanceOwed}), 0)` })
          .from(vendors)
          .where(and(eq(vendors.companyId, companyId), isNull(vendors.deletedAt))),

        // Cash balance (sum of active bank account balances)
        db
          .select({ total: sql<string>`COALESCE(SUM(${bankAccounts.currentBalance}), 0)` })
          .from(bankAccounts)
          .where(and(eq(bankAccounts.companyId, companyId), eq(bankAccounts.isActive, true))),

        // Open invoices (sent or partial)
        db
          .select({
            count: sql<number>`COUNT(*)`,
            total: sql<string>`COALESCE(SUM(${invoices.total} - ${invoices.amountPaid}), 0)`,
          })
          .from(invoices)
          .where(
            and(
              eq(invoices.companyId, companyId),
              isNull(invoices.deletedAt),
              or(eq(invoices.status, 'sent'), eq(invoices.status, 'partial')),
            ),
          ),

        // Open bills (approved or partial)
        db
          .select({
            count: sql<number>`COUNT(*)`,
            total: sql<string>`COALESCE(SUM(${bills.total} - ${bills.amountPaid}), 0)`,
          })
          .from(bills)
          .where(
            and(
              eq(bills.companyId, companyId),
              isNull(bills.deletedAt),
              or(eq(bills.status, 'approved'), eq(bills.status, 'partial')),
            ),
          ),

        // Recent invoices (last 5)
        db
          .select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            customerName: customers.name,
            date: invoices.date,
            total: invoices.total,
            amountPaid: invoices.amountPaid,
            status: invoices.status,
          })
          .from(invoices)
          .innerJoin(customers, eq(invoices.customerId, customers.id))
          .where(and(eq(invoices.companyId, companyId), isNull(invoices.deletedAt)))
          .orderBy(desc(invoices.createdAt))
          .limit(5),

        // Recent bills (last 5)
        db
          .select({
            id: bills.id,
            billNumber: bills.billNumber,
            vendorName: vendors.name,
            date: bills.date,
            total: bills.total,
            amountPaid: bills.amountPaid,
            status: bills.status,
          })
          .from(bills)
          .innerJoin(vendors, eq(bills.vendorId, vendors.id))
          .where(and(eq(bills.companyId, companyId), isNull(bills.deletedAt)))
          .orderBy(desc(bills.createdAt))
          .limit(5),
      ]);

    res.json({
      success: true,
      data: {
        period: { monthStart, monthEnd },
        kpis: {
          monthRevenue: pnl.totalRevenue,
          monthExpenses: pnl.totalExpenses,
          monthNetIncome: pnl.netIncome,
          cashBalance: cashRow[0]?.total ?? '0.00',
          totalAR: arRow[0]?.total ?? '0.00',
          totalAP: apRow[0]?.total ?? '0.00',
          openInvoiceCount: Number(openInvoicesRow[0]?.count ?? 0),
          openInvoiceBalance: openInvoicesRow[0]?.total ?? '0.00',
          openBillCount: Number(openBillsRow[0]?.count ?? 0),
          openBillBalance: openBillsRow[0]?.total ?? '0.00',
        },
        recentInvoices,
        recentBills,
      },
    });
  } catch (e) {
    next(e);
  }
}
