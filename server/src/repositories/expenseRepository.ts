import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { getDb } from '../db/connection';
import { expenses, expenseLines, expenseAttachments } from '../db/schema';
import { taxSettings, companies } from '../db/schema/company';
import { accounts } from '../db/schema/accounts';
import { vendors } from '../db/schema/billing';

// ─── Expense number ────────────────────────────────────────────────────────────

async function nextExpenseNumber(companyId: number): Promise<string> {
  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(expenses)
    .where(eq(expenses.companyId, companyId));
  const num = (Number(count) + 1).toString().padStart(4, '0');
  return `EXP-${num}`;
}

// ─── Expense CRUD ──────────────────────────────────────────────────────────────

export async function listExpenses(companyId: number, page = 1, limit = 50) {
  const db = getDb();
  const offset = (page - 1) * limit;

  const rows = await db
    .select({
      id: expenses.id,
      expenseNumber: expenses.expenseNumber,
      vendorId: expenses.vendorId,
      vendorName: vendors.name,
      date: expenses.date,
      description: expenses.description,
      status: expenses.status,
      subtotal: expenses.subtotal,
      taxAmount: expenses.taxAmount,
      total: expenses.total,
      paymentAccountId: expenses.paymentAccountId,
      paymentAccountName: accounts.name,
      postedAt: expenses.postedAt,
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .leftJoin(vendors, eq(expenses.vendorId, vendors.id))
    .innerJoin(accounts, eq(expenses.paymentAccountId, accounts.id))
    .where(and(eq(expenses.companyId, companyId), isNull(expenses.deletedAt)))
    .orderBy(desc(expenses.date), desc(expenses.id))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(expenses)
    .where(and(eq(expenses.companyId, companyId), isNull(expenses.deletedAt)));

  return { expenses: rows, total: Number(count), page, limit };
}

export async function findExpenseWithLines(id: number, companyId: number) {
  const db = getDb();

  const [expense] = await db
    .select({
      id: expenses.id,
      companyId: expenses.companyId,
      expenseNumber: expenses.expenseNumber,
      vendorId: expenses.vendorId,
      vendorName: vendors.name,
      paymentAccountId: expenses.paymentAccountId,
      paymentAccountName: accounts.name,
      date: expenses.date,
      description: expenses.description,
      status: expenses.status,
      subtotal: expenses.subtotal,
      taxAmount: expenses.taxAmount,
      total: expenses.total,
      journalEntryId: expenses.journalEntryId,
      postedAt: expenses.postedAt,
      voidedAt: expenses.voidedAt,
      notes: expenses.notes,
      createdBy: expenses.createdBy,
    })
    .from(expenses)
    .leftJoin(vendors, eq(expenses.vendorId, vendors.id))
    .innerJoin(accounts, eq(expenses.paymentAccountId, accounts.id))
    .where(and(eq(expenses.id, id), eq(expenses.companyId, companyId), isNull(expenses.deletedAt)))
    .limit(1);

  if (!expense) return null;

  const lines = await db
    .select({
      id: expenseLines.id,
      expenseId: expenseLines.expenseId,
      expenseAccountId: expenseLines.expenseAccountId,
      expenseAccountName: accounts.name,
      description: expenseLines.description,
      amount: expenseLines.amount,
      taxCodeId: expenseLines.taxCodeId,
      taxCodeName: taxSettings.taxName,
      taxAmount: expenseLines.taxAmount,
    })
    .from(expenseLines)
    .leftJoin(accounts, eq(expenseLines.expenseAccountId, accounts.id))
    .leftJoin(taxSettings, eq(expenseLines.taxCodeId, taxSettings.id))
    .where(eq(expenseLines.expenseId, id));

  return { ...expense, lines };
}

export interface ExpenseLineInput {
  expenseAccountId: number;
  description: string;
  amount: string;
  taxCodeId?: number | null;
  taxAmount: string;
}

function computeTotals(lines: ExpenseLineInput[]) {
  let subtotal = 0;
  let taxAmount = 0;
  for (const line of lines) {
    subtotal += parseFloat(line.amount);
    taxAmount += parseFloat(line.taxAmount);
  }
  return {
    subtotal: subtotal.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    total: (subtotal + taxAmount).toFixed(2),
  };
}

export async function createExpense(
  companyId: number,
  createdBy: number,
  data: {
    vendorId?: number | null;
    paymentAccountId: number;
    date: string;
    description: string;
    notes?: string;
  },
  lines: ExpenseLineInput[]
) {
  const db = getDb();
  const expenseNumber = await nextExpenseNumber(companyId);
  const totals = computeTotals(lines);

  const [result] = await db.insert(expenses).values({
    companyId,
    expenseNumber,
    createdBy,
    status: 'draft',
    ...data,
    vendorId: data.vendorId ?? null,
    ...totals,
  }) as any;
  const expenseId = result.insertId as number;

  if (lines.length > 0) {
    await db.insert(expenseLines).values(
      lines.map((line) => ({
        expenseId,
        expenseAccountId: line.expenseAccountId,
        description: line.description,
        amount: line.amount,
        taxCodeId: line.taxCodeId ?? null,
        taxAmount: line.taxAmount,
      }))
    );
  }

  return expenseId;
}

export async function updateExpense(
  id: number,
  companyId: number,
  data: Partial<{
    vendorId: number | null;
    paymentAccountId: number;
    date: string;
    description: string;
    notes: string;
  }>,
  lines?: ExpenseLineInput[]
) {
  const db = getDb();
  const updateData: Record<string, any> = { ...data };

  if (lines !== undefined) {
    const totals = computeTotals(lines);
    Object.assign(updateData, totals);
    await db.delete(expenseLines).where(eq(expenseLines.expenseId, id));
    if (lines.length > 0) {
      await db.insert(expenseLines).values(
        lines.map((line) => ({
          expenseId: id,
          expenseAccountId: line.expenseAccountId,
          description: line.description,
          amount: line.amount,
          taxCodeId: line.taxCodeId ?? null,
          taxAmount: line.taxAmount,
        }))
      );
    }
  }

  await db.update(expenses).set(updateData).where(and(eq(expenses.id, id), eq(expenses.companyId, companyId)));
}

export async function updateExpensePosted(id: number, companyId: number, journalEntryId: number) {
  const db = getDb();
  await db
    .update(expenses)
    .set({ status: 'posted', journalEntryId, postedAt: new Date() })
    .where(and(eq(expenses.id, id), eq(expenses.companyId, companyId)));
}

export async function updateExpenseVoided(id: number, companyId: number) {
  const db = getDb();
  await db
    .update(expenses)
    .set({ status: 'voided', voidedAt: new Date() })
    .where(and(eq(expenses.id, id), eq(expenses.companyId, companyId)));
}

export async function softDeleteExpense(id: number, companyId: number) {
  const db = getDb();
  await db
    .update(expenses)
    .set({ deletedAt: new Date() })
    .where(and(eq(expenses.id, id), eq(expenses.companyId, companyId)));
}

// ─── Tax code lookup ───────────────────────────────────────────────────────────

export async function findTaxCodeById(id: number, companyId: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(taxSettings)
    .where(and(eq(taxSettings.id, id), eq(taxSettings.companyId, companyId)))
    .limit(1);
  return row ?? null;
}

// ─── Attachment helpers ────────────────────────────────────────────────────────

export async function listExpenseAttachments(expenseId: number, companyId: number) {
  const db = getDb();
  return db
    .select()
    .from(expenseAttachments)
    .where(and(eq(expenseAttachments.expenseId, expenseId), eq(expenseAttachments.companyId, companyId)))
    .orderBy(desc(expenseAttachments.createdAt));
}

export async function createExpenseAttachment(data: {
  expenseId: number;
  companyId: number;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
}) {
  const db = getDb();
  const [result] = await db.insert(expenseAttachments).values(data) as any;
  return result.insertId as number;
}

export async function findExpenseAttachment(id: number, companyId: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(expenseAttachments)
    .where(and(eq(expenseAttachments.id, id), eq(expenseAttachments.companyId, companyId)))
    .limit(1);
  return row ?? null;
}

export async function deleteExpenseAttachment(id: number) {
  const db = getDb();
  await db.delete(expenseAttachments).where(eq(expenseAttachments.id, id));
}
