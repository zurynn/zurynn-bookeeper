import { eq, and, gte, lte, lt, isNull, sql, or, inArray } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import { getDb } from '../db/connection';
import { accounts, accountTypes, journalEntries, journalEntryLines } from '../db/schema';
import { invoices } from '../db/schema/invoicing';

// ─── Shared helper ─────────────────────────────────────────────────────────────

async function fetchAccountActivity(
  companyId: number,
  dateConditions: ReturnType<typeof and>[],
) {
  const db = getDb();
  return db
    .select({
      accountId: accounts.id,
      code: accounts.code,
      name: accounts.name,
      typeName: accountTypes.name,
      normalBalance: accountTypes.normalBalance,
      totalDebits: sql<string>`COALESCE(SUM(${journalEntryLines.debit}), 0)`,
      totalCredits: sql<string>`COALESCE(SUM(${journalEntryLines.credit}), 0)`,
    })
    .from(accounts)
    .innerJoin(accountTypes, eq(accounts.accountTypeId, accountTypes.id))
    .innerJoin(journalEntryLines, eq(journalEntryLines.accountId, accounts.id))
    .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
    .where(
      and(
        eq(accounts.companyId, companyId),
        isNull(accounts.deletedAt),
        eq(journalEntries.status, 'posted'),
        eq(journalEntries.companyId, companyId),
        ...dateConditions,
      ),
    )
    .groupBy(accounts.id, accounts.code, accounts.name, accountTypes.name, accountTypes.normalBalance)
    .orderBy(accounts.code);
}

function normalNet(totalDebits: string, totalCredits: string, normalBalance: string): string {
  if (normalBalance === 'debit') {
    return new Decimal(totalDebits).minus(totalCredits).toFixed(2);
  }
  return new Decimal(totalCredits).minus(totalDebits).toFixed(2);
}

// ─── P&L ───────────────────────────────────────────────────────────────────────

export async function getPnL(companyId: number, startDate: string, endDate: string) {
  const rows = await fetchAccountActivity(companyId, [
    gte(journalEntries.date, startDate),
    lte(journalEntries.date, endDate),
  ]);

  const revenueRows = rows.filter((r) => r.typeName === 'Revenue');
  const expenseRows = rows.filter((r) => r.typeName === 'Expense');

  const revenue = revenueRows.map((r) => ({
    accountId: r.accountId,
    code: r.code,
    name: r.name,
    net: normalNet(r.totalDebits, r.totalCredits, r.normalBalance),
  }));

  const expenses = expenseRows.map((r) => ({
    accountId: r.accountId,
    code: r.code,
    name: r.name,
    net: normalNet(r.totalDebits, r.totalCredits, r.normalBalance),
  }));

  const totalRevenue = revenue
    .reduce((s, r) => s.plus(r.net), new Decimal(0))
    .toFixed(2);
  const totalExpenses = expenses
    .reduce((s, r) => s.plus(r.net), new Decimal(0))
    .toFixed(2);
  const netIncome = new Decimal(totalRevenue).minus(totalExpenses).toFixed(2);

  return { startDate, endDate, revenue, expenses, totalRevenue, totalExpenses, netIncome };
}

// ─── Balance Sheet ─────────────────────────────────────────────────────────────

export async function getBalanceSheet(companyId: number, asOfDate: string) {
  const rows = await fetchAccountActivity(companyId, [lte(journalEntries.date, asOfDate)]);

  const toLine = (r: (typeof rows)[0]) => ({
    accountId: r.accountId,
    code: r.code,
    name: r.name,
    balance: normalNet(r.totalDebits, r.totalCredits, r.normalBalance),
  });

  const assets = rows.filter((r) => r.typeName === 'Asset').map(toLine);
  const liabilities = rows.filter((r) => r.typeName === 'Liability').map(toLine);
  const equityAccounts = rows.filter((r) => r.typeName === 'Equity').map(toLine);

  // Current-year net income as a synthetic equity line
  const yearStart = asOfDate.slice(0, 4) + '-01-01';
  const pnl = await getPnL(companyId, yearStart, asOfDate);
  const equity = [
    ...equityAccounts,
    { accountId: 0, code: 'RE', name: 'Net Income (Current Year)', balance: pnl.netIncome },
  ];

  const totalAssets = assets
    .reduce((s, r) => s.plus(r.balance), new Decimal(0))
    .toFixed(2);
  const totalLiabilities = liabilities
    .reduce((s, r) => s.plus(r.balance), new Decimal(0))
    .toFixed(2);
  const totalEquity = equity
    .reduce((s, r) => s.plus(r.balance), new Decimal(0))
    .toFixed(2);
  const totalLiabilitiesAndEquity = new Decimal(totalLiabilities).plus(totalEquity).toFixed(2);

  return {
    asOfDate,
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity,
  };
}

// ─── Cash Flow ─────────────────────────────────────────────────────────────────

export async function getCashFlow(companyId: number, startDate: string, endDate: string) {
  const db = getDb();

  // Cash accounts = Asset accounts with code starting with '10'
  const allAssets = await db
    .select({ id: accounts.id, code: accounts.code, name: accounts.name })
    .from(accounts)
    .innerJoin(accountTypes, eq(accounts.accountTypeId, accountTypes.id))
    .where(
      and(
        eq(accounts.companyId, companyId),
        isNull(accounts.deletedAt),
        eq(accountTypes.name, 'Asset'),
      ),
    );

  const cashAccounts = allAssets.filter((a) => a.code.startsWith('10'));
  if (cashAccounts.length === 0) {
    const pnl = await getPnL(companyId, startDate, endDate);
    return {
      startDate,
      endDate,
      cashAccounts: [],
      beginningCash: '0.00',
      periodDebits: '0.00',
      periodCredits: '0.00',
      netChange: '0.00',
      endingCash: '0.00',
      netIncome: pnl.netIncome,
    };
  }

  const cashIds = cashAccounts.map((a) => a.id);

  const aggregate = async (dateWhere: ReturnType<typeof and>) => {
    const [row] = await db
      .select({
        totalDebits: sql<string>`COALESCE(SUM(${journalEntryLines.debit}), 0)`,
        totalCredits: sql<string>`COALESCE(SUM(${journalEntryLines.credit}), 0)`,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(
        and(
          inArray(journalEntryLines.accountId, cashIds),
          eq(journalEntries.status, 'posted'),
          eq(journalEntries.companyId, companyId),
          dateWhere,
        ),
      );
    return row;
  };

  const before = await aggregate(lt(journalEntries.date, startDate));
  const during = await aggregate(
    and(gte(journalEntries.date, startDate), lte(journalEntries.date, endDate))!,
  );

  const beginningCash = new Decimal(before.totalDebits)
    .minus(before.totalCredits)
    .toFixed(2);
  const periodDebits = new Decimal(during.totalDebits).toFixed(2);
  const periodCredits = new Decimal(during.totalCredits).toFixed(2);
  const netChange = new Decimal(periodDebits).minus(periodCredits).toFixed(2);
  const endingCash = new Decimal(beginningCash).plus(netChange).toFixed(2);

  const pnl = await getPnL(companyId, startDate, endDate);

  return {
    startDate,
    endDate,
    cashAccounts: cashAccounts.map((a) => a.name),
    beginningCash,
    periodDebits,
    periodCredits,
    netChange,
    endingCash,
    netIncome: pnl.netIncome,
  };
}

// ─── Tax Summary ───────────────────────────────────────────────────────────────

export async function getTaxSummary(companyId: number, startDate: string, endDate: string) {
  const db = getDb();

  const rows = await db
    .select({
      period: sql<string>`DATE_FORMAT(${invoices.date}, '%Y-%m')`,
      invoiceCount: sql<number>`COUNT(DISTINCT ${invoices.id})`,
      subtotal: sql<string>`COALESCE(SUM(${invoices.subtotal}), 0)`,
      taxAmount: sql<string>`COALESCE(SUM(${invoices.taxAmount}), 0)`,
      total: sql<string>`COALESCE(SUM(${invoices.total}), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.companyId, companyId),
        isNull(invoices.deletedAt),
        or(
          eq(invoices.status, 'sent'),
          eq(invoices.status, 'partial'),
          eq(invoices.status, 'paid'),
        ),
        gte(invoices.date, startDate),
        lte(invoices.date, endDate),
        sql`${invoices.taxAmount} > 0`,
      ),
    )
    .groupBy(sql`DATE_FORMAT(${invoices.date}, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(${invoices.date}, '%Y-%m')`);

  const totalSubtotal = rows.reduce((s, r) => s.plus(r.subtotal), new Decimal(0)).toFixed(2);
  const totalTaxAmount = rows.reduce((s, r) => s.plus(r.taxAmount), new Decimal(0)).toFixed(2);
  const totalAmount = rows.reduce((s, r) => s.plus(r.total), new Decimal(0)).toFixed(2);

  return {
    startDate,
    endDate,
    periods: rows.map((r) => ({
      period: r.period,
      invoiceCount: Number(r.invoiceCount),
      subtotal: new Decimal(r.subtotal).toFixed(2),
      taxAmount: new Decimal(r.taxAmount).toFixed(2),
      total: new Decimal(r.total).toFixed(2),
    })),
    totalSubtotal,
    totalTaxAmount,
    totalAmount,
  };
}
