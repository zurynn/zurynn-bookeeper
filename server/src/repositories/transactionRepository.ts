import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../db/connection';
import { simpleTransactions } from '../db/schema/transactions';
import { journalEntries, journalEntryLines } from '../db/schema/ledger';
import { accounts } from '../db/schema/accounts';
import { findAccountByCode } from './accountRepository';
import { AppError } from '../middlewares/errorHandler';

export const INCOME_CATEGORIES: Record<string, string> = {
  'Sales / Products': '4000',
  'Services': '4100',
  'Other Income': '4200',
};

export const EXPENSE_CATEGORIES: Record<string, string> = {
  'Cost of Goods Sold': '5000',
  'Rent': '5100',
  'Utilities': '5200',
  'Payroll': '5300',
  'Office Supplies': '5400',
  'Marketing & Advertising': '5500',
  'Professional Services': '5600',
  'Insurance': '5700',
  'Other Expenses': '5900',
};

export async function listTransactions(companyId: number, page = 1, limit = 50) {
  const db = getDb();
  const offset = (page - 1) * limit;

  const rows = await db
    .select()
    .from(simpleTransactions)
    .where(eq(simpleTransactions.companyId, companyId))
    .orderBy(desc(simpleTransactions.date), desc(simpleTransactions.id))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(simpleTransactions)
    .where(eq(simpleTransactions.companyId, companyId));

  return { transactions: rows, total: Number(count), page, limit };
}

export async function findTransactionById(id: number, companyId: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(simpleTransactions)
    .where(and(eq(simpleTransactions.id, id), eq(simpleTransactions.companyId, companyId)))
    .limit(1);
  return row ?? null;
}

export async function createTransaction(data: {
  companyId: number;
  createdBy: number;
  type: 'income' | 'expense';
  date: string;
  description: string;
  amount: string;
  category: string;
}) {
  const db = getDb();
  const categoryMap = data.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const accountCode = categoryMap[data.category];
  if (!accountCode) throw new AppError(400, `Unknown category: ${data.category}`, 'BAD_CATEGORY');

  const cashId = await findAccountByCode(data.companyId, '1000');
  const categoryAccountId = await findAccountByCode(data.companyId, accountCode);

  if (!cashId || !categoryAccountId) {
    throw new AppError(500, 'Default accounts not found. Please ensure the company was set up correctly.', 'MISSING_ACCOUNTS');
  }

  // income: DR Cash / CR Revenue account
  // expense: DR Expense account / CR Cash
  const lines =
    data.type === 'income'
      ? [
          { accountId: cashId, debit: data.amount, credit: '0.00' },
          { accountId: categoryAccountId, debit: '0.00', credit: data.amount },
        ]
      : [
          { accountId: categoryAccountId, debit: data.amount, credit: '0.00' },
          { accountId: cashId, debit: '0.00', credit: data.amount },
        ];

  // Create and immediately post the journal entry
  const [jeResult] = await db.insert(journalEntries).values({
    companyId: data.companyId,
    date: data.date,
    description: data.description,
    status: 'posted',
    createdBy: data.createdBy,
  }) as any;
  const journalEntryId = jeResult.insertId as number;

  await db.insert(journalEntryLines).values(
    lines.map((l) => ({ journalEntryId, ...l }))
  );

  const [txResult] = await db.insert(simpleTransactions).values({
    companyId: data.companyId,
    type: data.type,
    date: data.date,
    description: data.description,
    amount: data.amount,
    category: data.category,
    accountCode,
    journalEntryId,
    createdBy: data.createdBy,
  }) as any;

  return txResult.insertId as number;
}

export async function deleteTransaction(id: number, companyId: number) {
  const db = getDb();
  const tx = await findTransactionById(id, companyId);
  if (!tx) throw new AppError(404, 'Transaction not found', 'NOT_FOUND');

  // Reverse the journal entry rather than hard-deleting it (preserves audit trail)
  if (tx.journalEntryId) {
    const [jeRow] = await db
      .select({ lines: journalEntryLines })
      .from(journalEntries)
      .where(eq(journalEntries.id, tx.journalEntryId))
      .limit(1) as any;

    const lines = await db
      .select()
      .from(journalEntryLines)
      .where(eq(journalEntryLines.journalEntryId, tx.journalEntryId));

    const [revResult] = await db.insert(journalEntries).values({
      companyId,
      date: tx.date,
      description: `VOID: ${tx.description}`,
      status: 'posted',
      reversalOfId: tx.journalEntryId,
      createdBy: tx.createdBy,
    }) as any;

    await db.insert(journalEntryLines).values(
      lines.map((l) => ({
        journalEntryId: revResult.insertId,
        accountId: l.accountId,
        debit: l.credit,
        credit: l.debit,
      }))
    );
  }

  await db.delete(simpleTransactions).where(eq(simpleTransactions.id, id));
}

export async function getCashBalance(companyId: number) {
  const db = getDb();
  const [row] = await db
    .select({
      debits: sql<string>`COALESCE(SUM(${journalEntryLines.debit}), 0)`,
      credits: sql<string>`COALESCE(SUM(${journalEntryLines.credit}), 0)`,
    })
    .from(journalEntryLines)
    .innerJoin(
      journalEntries,
      and(
        eq(journalEntryLines.journalEntryId, journalEntries.id),
        eq(journalEntries.status, 'posted'),
        eq(journalEntries.companyId, companyId),
      )
    )
    .innerJoin(
      accounts,
      and(
        eq(journalEntryLines.accountId, accounts.id),
        sql`${accounts.code} LIKE '10%'`
      )
    );

  const debits = parseFloat(row?.debits ?? '0');
  const credits = parseFloat(row?.credits ?? '0');
  return (debits - credits).toFixed(2);
}

export async function getRecentTransactions(companyId: number, limit = 10) {
  const db = getDb();
  return db
    .select()
    .from(simpleTransactions)
    .where(eq(simpleTransactions.companyId, companyId))
    .orderBy(desc(simpleTransactions.date), desc(simpleTransactions.id))
    .limit(limit);
}
