import { eq, and, isNull, desc, sql, inArray } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import { getDb } from '../db/connection';
import { bankAccounts, bankTransactions, reconciliations } from '../db/schema';
import { AppError } from '../middlewares/errorHandler';

// ─── Bank Accounts ─────────────────────────────────────────────────────────────

export async function listBankAccounts(companyId: number) {
  const db = getDb();
  return db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.companyId, companyId))
    .orderBy(bankAccounts.name);
}

export async function findBankAccountById(id: number, companyId: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(bankAccounts)
    .where(and(eq(bankAccounts.id, id), eq(bankAccounts.companyId, companyId)))
    .limit(1);
  return row ?? null;
}

export async function createBankAccount(
  companyId: number,
  data: {
    name: string;
    bankName?: string;
    accountNumber?: string;
    routingNumber?: string;
    accountId?: number;
    openingBalance?: string;
  },
) {
  const db = getDb();
  const [result] = await db.insert(bankAccounts).values({
    companyId,
    name: data.name,
    bankName: data.bankName ?? null,
    accountNumber: data.accountNumber ?? null,
    routingNumber: data.routingNumber ?? null,
    accountId: data.accountId ?? null,
    currentBalance: data.openingBalance ? new Decimal(data.openingBalance).toFixed(2) : '0.00',
  });
  return findBankAccountById((result as any).insertId, companyId);
}

export async function updateBankAccount(
  id: number,
  companyId: number,
  data: { name?: string; bankName?: string; accountNumber?: string; routingNumber?: string },
) {
  const db = getDb();
  await db
    .update(bankAccounts)
    .set(data)
    .where(and(eq(bankAccounts.id, id), eq(bankAccounts.companyId, companyId)));
  return findBankAccountById(id, companyId);
}

export async function deactivateBankAccount(id: number, companyId: number) {
  const db = getDb();
  await db
    .update(bankAccounts)
    .set({ isActive: false })
    .where(and(eq(bankAccounts.id, id), eq(bankAccounts.companyId, companyId)));
}

// ─── Transactions ──────────────────────────────────────────────────────────────

export async function listTransactions(
  bankAccountId: number,
  page = 1,
  pageSize = 50,
  filter: 'all' | 'unmatched' | 'unreconciled' = 'all',
) {
  const db = getDb();
  const offset = (page - 1) * pageSize;
  const base = eq(bankTransactions.bankAccountId, bankAccountId);

  let whereClause: any = base;
  if (filter === 'unmatched') {
    whereClause = and(base, isNull(bankTransactions.matchedJournalEntryId));
  } else if (filter === 'unreconciled') {
    whereClause = and(base, eq(bankTransactions.reconciled, false));
  }

  const rows = await db
    .select()
    .from(bankTransactions)
    .where(whereClause)
    .orderBy(desc(bankTransactions.date), desc(bankTransactions.id))
    .limit(pageSize)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(bankTransactions)
    .where(whereClause);

  return {
    transactions: rows,
    total: Number(total),
    page,
    pages: Math.ceil(Number(total) / pageSize),
  };
}

export async function addTransaction(
  bankAccountId: number,
  data: { date: string; description: string; amount: string; type: 'debit' | 'credit' },
) {
  const db = getDb();
  const absAmount = new Decimal(data.amount).abs().toFixed(2);

  const [result] = await db.insert(bankTransactions).values({
    bankAccountId,
    date: data.date,
    description: data.description,
    amount: absAmount,
    type: data.type,
  });

  // Update running balance: credits add, debits subtract
  const delta = data.type === 'credit' ? absAmount : new Decimal(absAmount).negated().toFixed(2);
  await db
    .update(bankAccounts)
    .set({ currentBalance: sql`current_balance + ${delta}` })
    .where(eq(bankAccounts.id, bankAccountId));

  const [row] = await db
    .select()
    .from(bankTransactions)
    .where(eq(bankTransactions.id, (result as any).insertId))
    .limit(1);
  return row;
}

export async function importTransactions(
  bankAccountId: number,
  rows: Array<{ date: string; description: string; amount: string; type: 'debit' | 'credit' }>,
) {
  if (rows.length === 0) return { imported: 0 };
  const db = getDb();

  await db.insert(bankTransactions).values(
    rows.map((r) => ({
      bankAccountId,
      date: r.date,
      description: r.description,
      amount: new Decimal(r.amount).abs().toFixed(2),
      type: r.type,
    })),
  );

  // Recompute balance from all transactions for accuracy
  const [{ balance }] = await db
    .select({
      balance: sql<string>`COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0)`,
    })
    .from(bankTransactions)
    .where(eq(bankTransactions.bankAccountId, bankAccountId));

  await db
    .update(bankAccounts)
    .set({ currentBalance: new Decimal(balance).toFixed(2) })
    .where(eq(bankAccounts.id, bankAccountId));

  return { imported: rows.length };
}

export async function matchTransaction(txId: number, bankAccountId: number, journalEntryId: number) {
  const db = getDb();
  const [tx] = await db
    .select()
    .from(bankTransactions)
    .where(and(eq(bankTransactions.id, txId), eq(bankTransactions.bankAccountId, bankAccountId)))
    .limit(1);
  if (!tx) throw new AppError(404, 'Transaction not found', 'NOT_FOUND');

  await db
    .update(bankTransactions)
    .set({ matchedJournalEntryId: journalEntryId })
    .where(eq(bankTransactions.id, txId));
}

export async function unmatchTransaction(txId: number, bankAccountId: number) {
  const db = getDb();
  await db
    .update(bankTransactions)
    .set({ matchedJournalEntryId: null })
    .where(and(eq(bankTransactions.id, txId), eq(bankTransactions.bankAccountId, bankAccountId)));
}

// ─── Reconciliation ────────────────────────────────────────────────────────────

export async function listReconciliations(bankAccountId: number) {
  const db = getDb();
  return db
    .select()
    .from(reconciliations)
    .where(eq(reconciliations.bankAccountId, bankAccountId))
    .orderBy(desc(reconciliations.statementDate));
}

export async function getOpenReconciliation(bankAccountId: number) {
  const db = getDb();
  const [recon] = await db
    .select()
    .from(reconciliations)
    .where(and(eq(reconciliations.bankAccountId, bankAccountId), eq(reconciliations.status, 'open')))
    .limit(1);
  if (!recon) return null;

  const txs = await db
    .select()
    .from(bankTransactions)
    .where(and(eq(bankTransactions.bankAccountId, bankAccountId), eq(bankTransactions.reconciled, false)))
    .orderBy(bankTransactions.date);

  return { reconciliation: recon, transactions: txs };
}

export async function startReconciliation(
  bankAccountId: number,
  statementDate: string,
  statementBalance: string,
) {
  const db = getDb();
  const [open] = await db
    .select()
    .from(reconciliations)
    .where(and(eq(reconciliations.bankAccountId, bankAccountId), eq(reconciliations.status, 'open')))
    .limit(1);
  if (open) {
    throw new AppError(
      400,
      'An open reconciliation already exists for this account.',
      'ALREADY_OPEN',
    );
  }

  const [result] = await db.insert(reconciliations).values({
    bankAccountId,
    statementDate,
    statementBalance: new Decimal(statementBalance).toFixed(2),
    status: 'open',
  });

  const [row] = await db
    .select()
    .from(reconciliations)
    .where(eq(reconciliations.id, (result as any).insertId))
    .limit(1);
  return row;
}

export async function closeReconciliation(
  reconId: number,
  bankAccountId: number,
  markedTxIds: number[],
) {
  const db = getDb();
  const [recon] = await db
    .select()
    .from(reconciliations)
    .where(and(eq(reconciliations.id, reconId), eq(reconciliations.bankAccountId, bankAccountId)))
    .limit(1);
  if (!recon) throw new AppError(404, 'Reconciliation not found', 'NOT_FOUND');
  if (recon.status !== 'open') throw new AppError(400, 'Reconciliation is already closed', 'ALREADY_CLOSED');

  // Mark selected transactions as reconciled
  if (markedTxIds.length > 0) {
    await db
      .update(bankTransactions)
      .set({ reconciled: true })
      .where(
        and(
          inArray(bankTransactions.id, markedTxIds),
          eq(bankTransactions.bankAccountId, bankAccountId),
        ),
      );
  }

  // Compute cumulative reconciled balance from all reconciled transactions
  const [{ balance }] = await db
    .select({
      balance: sql<string>`COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0)`,
    })
    .from(bankTransactions)
    .where(and(eq(bankTransactions.bankAccountId, bankAccountId), eq(bankTransactions.reconciled, true)));

  await db
    .update(reconciliations)
    .set({
      status: 'closed',
      reconciledBalance: new Decimal(balance).toFixed(2),
      completedAt: new Date(),
    })
    .where(eq(reconciliations.id, reconId));

  const [row] = await db
    .select()
    .from(reconciliations)
    .where(eq(reconciliations.id, reconId))
    .limit(1);
  return row;
}
