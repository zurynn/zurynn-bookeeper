import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../db/connection';
import { journalEntries, journalEntryLines, accounts } from '../db/schema';
import { AppError } from '../middlewares/errorHandler';

export interface JournalLineInput {
  accountId: number;
  debit: string;
  credit: string;
  memo?: string;
}

export async function listJournalEntries(companyId: number, page = 1, limit = 50) {
  const db = getDb();
  const offset = (page - 1) * limit;

  const rows = await db
    .select({
      id: journalEntries.id,
      date: journalEntries.date,
      description: journalEntries.description,
      reference: journalEntries.reference,
      status: journalEntries.status,
      reversalOfId: journalEntries.reversalOfId,
      createdAt: journalEntries.createdAt,
      totalDebits: sql<string>`COALESCE(SUM(${journalEntryLines.debit}), 0)`,
    })
    .from(journalEntries)
    .leftJoin(journalEntryLines, eq(journalEntryLines.journalEntryId, journalEntries.id))
    .where(eq(journalEntries.companyId, companyId))
    .groupBy(journalEntries.id)
    .orderBy(desc(journalEntries.date), desc(journalEntries.id))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(journalEntries)
    .where(eq(journalEntries.companyId, companyId));

  return { entries: rows, total: Number(count), page, limit };
}

export async function findJournalEntryWithLines(id: number, companyId: number) {
  const db = getDb();

  const [entry] = await db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.companyId, companyId)))
    .limit(1);

  if (!entry) return null;

  const lines = await db
    .select({
      id: journalEntryLines.id,
      accountId: journalEntryLines.accountId,
      accountCode: accounts.code,
      accountName: accounts.name,
      debit: journalEntryLines.debit,
      credit: journalEntryLines.credit,
      memo: journalEntryLines.memo,
    })
    .from(journalEntryLines)
    .innerJoin(accounts, eq(journalEntryLines.accountId, accounts.id))
    .where(eq(journalEntryLines.journalEntryId, id));

  return { ...entry, lines };
}

export async function createJournalEntryWithLines(
  data: { companyId: number; date: string; description: string; reference?: string; createdBy: number },
  lines: JournalLineInput[]
) {
  const db = getDb();
  const [result] = await db.insert(journalEntries).values({ ...data, status: 'draft' }) as any;
  const entryId = result.insertId as number;

  if (lines.length > 0) {
    await db.insert(journalEntryLines).values(
      lines.map((l) => ({ journalEntryId: entryId, ...l }))
    );
  }

  return entryId;
}

export async function replaceJournalLines(entryId: number, lines: JournalLineInput[]) {
  const db = getDb();
  await db.delete(journalEntryLines).where(eq(journalEntryLines.journalEntryId, entryId));
  if (lines.length > 0) {
    await db.insert(journalEntryLines).values(
      lines.map((l) => ({ journalEntryId: entryId, ...l }))
    );
  }
}

export async function updateJournalEntryHeader(
  id: number,
  companyId: number,
  data: Partial<{ date: string; description: string; reference: string }>
) {
  const db = getDb();
  await db
    .update(journalEntries)
    .set(data)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.companyId, companyId), eq(journalEntries.status, 'draft')));
}

export async function postJournalEntry(id: number, companyId: number) {
  const db = getDb();
  const result = await db
    .update(journalEntries)
    .set({ status: 'posted' })
    .where(and(eq(journalEntries.id, id), eq(journalEntries.companyId, companyId), eq(journalEntries.status, 'draft')));
  return (result as any)[0].affectedRows > 0;
}

export async function createReversalEntry(
  originalId: number,
  companyId: number,
  userId: number,
  date: string
) {
  const db = getDb();
  const original = await findJournalEntryWithLines(originalId, companyId);
  if (!original) throw new AppError(404, 'Journal entry not found', 'NOT_FOUND');
  if (original.status !== 'posted') throw new AppError(400, 'Only posted entries can be reversed', 'NOT_POSTED');

  const [result] = await db.insert(journalEntries).values({
    companyId,
    date,
    description: `REVERSAL: ${original.description}`,
    reference: original.reference ?? undefined,
    status: 'posted',
    reversalOfId: originalId,
    createdBy: userId,
  }) as any;
  const reversalId = result.insertId as number;

  await db.insert(journalEntryLines).values(
    original.lines.map((l) => ({
      journalEntryId: reversalId,
      accountId: l.accountId,
      debit: l.credit,   // swap debit ↔ credit
      credit: l.debit,
      memo: l.memo ?? undefined,
    }))
  );

  return reversalId;
}

export async function deleteJournalEntry(id: number, companyId: number) {
  const db = getDb();
  const [entry] = await db
    .select({ status: journalEntries.status })
    .from(journalEntries)
    .where(and(eq(journalEntries.id, id), eq(journalEntries.companyId, companyId)))
    .limit(1);

  if (!entry) throw new AppError(404, 'Journal entry not found', 'NOT_FOUND');
  if (entry.status === 'posted') throw new AppError(400, 'Posted entries cannot be deleted', 'ALREADY_POSTED');

  await db.delete(journalEntryLines).where(eq(journalEntryLines.journalEntryId, id));
  await db.delete(journalEntries).where(eq(journalEntries.id, id));
}
