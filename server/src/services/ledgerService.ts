import { eq } from 'drizzle-orm';
import { getDb } from '../db/connection';
import { journalEntries, journalEntryLines } from '../db/schema';
import { validateJournalEntry, JournalLine } from '../utils/ledgerEngine';

export interface PostTransactionPayload {
  companyId: number;
  date: string;
  description: string;
  reference: string;
  lines: JournalLine[];
  createdBy: number;
}

/**
 * Validates and posts a balanced set of journal lines as a single posted
 * journal entry. This is the sole entry point for writing to journal tables.
 * Returns the new journal_entry id.
 */
export async function postTransaction(payload: PostTransactionPayload): Promise<number> {
  // Throws LedgerError if debits ≠ credits or other invariant violated
  const validated = validateJournalEntry(payload.lines);

  const db = getDb();

  const [result] = await db.insert(journalEntries).values({
    companyId: payload.companyId,
    date: payload.date,
    description: payload.description,
    reference: payload.reference,
    status: 'posted',
    createdBy: payload.createdBy,
  }) as any;
  const jeId = result.insertId as number;

  await db.insert(journalEntryLines).values(
    validated.lines.map((line) => ({
      journalEntryId: jeId,
      accountId: line.accountId,
      debit: String(line.debit),
      credit: String(line.credit),
      memo: line.memo ?? null,
    }))
  );

  return jeId;
}

/**
 * Creates a reversing journal entry (all debits ↔ credits swapped) linked
 * back to the original via reversalOfId. Returns the new reversal JE id.
 */
export async function reverseTransaction(
  originalJeId: number,
  payload: Omit<PostTransactionPayload, 'lines'>
): Promise<number> {
  const db = getDb();

  const originalLines = await db
    .select()
    .from(journalEntryLines)
    .where(eq(journalEntryLines.journalEntryId, originalJeId));

  if (originalLines.length === 0) {
    throw new Error(`No lines found for journal entry ${originalJeId}`);
  }

  const reversalLines: JournalLine[] = originalLines.map((line) => ({
    accountId: line.accountId,
    debit: line.credit,   // swap
    credit: line.debit,   // swap
    memo: line.memo ?? undefined,
  }));

  const reversalJeId = await postTransaction({ ...payload, lines: reversalLines });

  await db
    .update(journalEntries)
    .set({ reversalOfId: reversalJeId })
    .where(eq(journalEntries.id, originalJeId));

  return reversalJeId;
}
