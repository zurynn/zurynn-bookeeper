import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import { getDb } from '../db/connection';
import { bills, billItems, billPayments, billAttachments, vendors } from '../db/schema';
import { journalEntries, journalEntryLines } from '../db/schema/ledger';
import { AppError } from '../middlewares/errorHandler';
import { findAccountByCode } from './accountRepository';
import { updateVendorBalance } from './vendorRepository';

export interface BillItemInput {
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  expenseAccountCode?: string; // optional: which expense account to debit
}

function computeItemAmount(qty: string, price: string): Decimal {
  return new Decimal(qty).times(new Decimal(price));
}

function computeTotals(items: BillItemInput[]) {
  let subtotal = new Decimal(0);
  let taxAmount = new Decimal(0);
  for (const item of items) {
    const amt = computeItemAmount(item.quantity, item.unitPrice);
    subtotal = subtotal.plus(amt);
    taxAmount = taxAmount.plus(amt.times(new Decimal(item.taxRate)));
  }
  return {
    subtotal: subtotal.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    total: subtotal.plus(taxAmount).toFixed(2),
  };
}

async function nextBillNumber(companyId: number): Promise<string> {
  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(bills)
    .where(eq(bills.companyId, companyId));
  const num = (Number(count) + 1).toString().padStart(4, '0');
  return `BILL-${num}`;
}

export async function listBills(companyId: number, page = 1, limit = 50) {
  const db = getDb();
  const offset = (page - 1) * limit;
  const rows = await db
    .select({
      id: bills.id,
      billNumber: bills.billNumber,
      vendorId: bills.vendorId,
      vendorName: vendors.name,
      date: bills.date,
      dueDate: bills.dueDate,
      status: bills.status,
      subtotal: bills.subtotal,
      taxAmount: bills.taxAmount,
      total: bills.total,
      amountPaid: bills.amountPaid,
      createdAt: bills.createdAt,
    })
    .from(bills)
    .innerJoin(vendors, eq(bills.vendorId, vendors.id))
    .where(and(eq(bills.companyId, companyId), isNull(bills.deletedAt)))
    .orderBy(desc(bills.date), desc(bills.id))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(bills)
    .where(and(eq(bills.companyId, companyId), isNull(bills.deletedAt)));

  return { bills: rows, total: Number(count), page, limit };
}

export async function findBillWithItems(id: number, companyId: number) {
  const db = getDb();
  const [bill] = await db
    .select({
      id: bills.id,
      companyId: bills.companyId,
      vendorId: bills.vendorId,
      vendorName: vendors.name,
      billNumber: bills.billNumber,
      date: bills.date,
      dueDate: bills.dueDate,
      status: bills.status,
      subtotal: bills.subtotal,
      taxAmount: bills.taxAmount,
      total: bills.total,
      amountPaid: bills.amountPaid,
      notes: bills.notes,
    })
    .from(bills)
    .innerJoin(vendors, eq(bills.vendorId, vendors.id))
    .where(and(eq(bills.id, id), eq(bills.companyId, companyId), isNull(bills.deletedAt)))
    .limit(1);
  if (!bill) return null;

  const items = await db.select().from(billItems).where(eq(billItems.billId, id));
  const billPaymentList = await db.select().from(billPayments).where(eq(billPayments.billId, id));

  return { ...bill, items, payments: billPaymentList };
}

export async function createBill(
  companyId: number,
  data: { vendorId: number; date: string; dueDate: string; notes?: string },
  items: BillItemInput[]
) {
  const db = getDb();
  const totals = computeTotals(items);
  const billNumber = await nextBillNumber(companyId);

  const [result] = await db.insert(bills).values({
    companyId,
    billNumber,
    status: 'draft',
    ...data,
    ...totals,
  }) as any;
  const billId = result.insertId as number;

  if (items.length > 0) {
    await db.insert(billItems).values(
      items.map((item) => ({
        billId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        amount: computeItemAmount(item.quantity, item.unitPrice).toFixed(2),
      }))
    );
  }

  return billId;
}

export async function updateBill(
  id: number,
  companyId: number,
  data: Partial<{ vendorId: number; date: string; dueDate: string; notes: string }>,
  items?: BillItemInput[]
) {
  const db = getDb();
  const existing = await findBillWithItems(id, companyId);
  if (!existing) throw new AppError(404, 'Bill not found', 'NOT_FOUND');
  if (existing.status !== 'draft') throw new AppError(400, 'Only draft bills can be edited', 'NOT_DRAFT');

  const updateData: Record<string, any> = { ...data };
  if (items) {
    const totals = computeTotals(items);
    Object.assign(updateData, totals);
    await db.delete(billItems).where(eq(billItems.billId, id));
    if (items.length > 0) {
      await db.insert(billItems).values(
        items.map((item) => ({
          billId: id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          amount: computeItemAmount(item.quantity, item.unitPrice).toFixed(2),
        }))
      );
    }
  }

  await db.update(bills).set(updateData).where(and(eq(bills.id, id), eq(bills.companyId, companyId)));
}

export async function approveBill(id: number, companyId: number, createdBy: number) {
  const db = getDb();
  const bill = await findBillWithItems(id, companyId);
  if (!bill) throw new AppError(404, 'Bill not found', 'NOT_FOUND');
  if (bill.status !== 'draft') throw new AppError(400, 'Bill is already approved', 'NOT_DRAFT');
  if (bill.items.length === 0) throw new AppError(400, 'Cannot approve bill with no items', 'NO_ITEMS');

  await db.update(bills).set({ status: 'approved' }).where(eq(bills.id, id));
  await updateVendorBalance(bill.vendorId, companyId, bill.total);

  // Auto journal entry: DR Expense / CR Accounts Payable
  const expenseId = await findAccountByCode(companyId, '5000');
  const apId = await findAccountByCode(companyId, '2000');

  if (expenseId && apId) {
    const [jeResult] = await db.insert(journalEntries).values({
      companyId,
      date: bill.date,
      description: `Bill ${bill.billNumber} — ${bill.vendorName}`,
      reference: bill.billNumber,
      status: 'posted',
      createdBy,
    }) as any;
    const jeId = jeResult.insertId as number;

    await db.insert(journalEntryLines).values([
      { journalEntryId: jeId, accountId: expenseId, debit: bill.subtotal, credit: '0.00' },
      { journalEntryId: jeId, accountId: apId, debit: '0.00', credit: bill.total },
    ]);
    await db.update(bills).set({ journalEntryId: jeId }).where(eq(bills.id, id));
  }
}

export async function recordBillPayment(
  id: number,
  companyId: number,
  createdBy: number,
  data: { date: string; amount: string; method: string; reference?: string; notes?: string }
) {
  const db = getDb();
  const bill = await findBillWithItems(id, companyId);
  if (!bill) throw new AppError(404, 'Bill not found', 'NOT_FOUND');
  if (bill.status === 'draft') throw new AppError(400, 'Bill must be approved before recording payment', 'NOT_APPROVED');
  if (bill.status === 'paid') throw new AppError(400, 'Bill is already fully paid', 'ALREADY_PAID');

  const remaining = new Decimal(bill.total).minus(new Decimal(bill.amountPaid));
  const payAmt = new Decimal(data.amount);
  if (payAmt.greaterThan(remaining)) {
    throw new AppError(400, `Payment exceeds remaining balance of ${remaining.toFixed(2)}`, 'OVERPAYMENT');
  }

  // Auto journal entry: DR Accounts Payable / CR Cash
  let jeId: number | undefined;
  const apId = await findAccountByCode(companyId, '2000');
  const cashId = await findAccountByCode(companyId, '1000');
  if (apId && cashId) {
    const [jeResult] = await db.insert(journalEntries).values({
      companyId,
      date: data.date,
      description: `Payment on Bill ${bill.billNumber} — ${bill.vendorName}`,
      reference: data.reference ?? bill.billNumber,
      status: 'posted',
      createdBy,
    }) as any;
    jeId = jeResult.insertId as number;
    await db.insert(journalEntryLines).values([
      { journalEntryId: jeId, accountId: apId, debit: data.amount, credit: '0.00' },
      { journalEntryId: jeId, accountId: cashId, debit: '0.00', credit: data.amount },
    ]);
  }

  await db.insert(billPayments).values({ companyId, billId: id, journalEntryId: jeId ?? null, ...data });

  const newPaid = new Decimal(bill.amountPaid).plus(payAmt);
  const newStatus = newPaid.greaterThanOrEqualTo(new Decimal(bill.total)) ? 'paid' : 'partial';
  await db.update(bills)
    .set({ amountPaid: newPaid.toFixed(2), status: newStatus })
    .where(eq(bills.id, id));

  await updateVendorBalance(bill.vendorId, companyId, payAmt.negated().toFixed(2));
}

export async function voidBill(id: number, companyId: number) {
  const db = getDb();
  const bill = await findBillWithItems(id, companyId);
  if (!bill) throw new AppError(404, 'Bill not found', 'NOT_FOUND');
  if (bill.status === 'paid') throw new AppError(400, 'Paid bills cannot be voided', 'ALREADY_PAID');

  await db.update(bills).set({ deletedAt: new Date() }).where(eq(bills.id, id));
  if (['approved', 'partial'].includes(bill.status)) {
    const outstanding = new Decimal(bill.total).minus(new Decimal(bill.amountPaid));
    await updateVendorBalance(bill.vendorId, companyId, outstanding.negated().toFixed(2));
  }
}

// ─── Attachment helpers ────────────────────────────────────────────────────────

export async function listBillAttachments(billId: number, companyId: number) {
  const db = getDb();
  return db
    .select()
    .from(billAttachments)
    .where(and(eq(billAttachments.billId, billId), eq(billAttachments.companyId, companyId)))
    .orderBy(desc(billAttachments.createdAt));
}

export async function createBillAttachment(data: {
  billId: number;
  companyId: number;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
}) {
  const db = getDb();
  const [result] = await db.insert(billAttachments).values(data) as any;
  return result.insertId as number;
}

export async function findBillAttachment(id: number, companyId: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(billAttachments)
    .where(and(eq(billAttachments.id, id), eq(billAttachments.companyId, companyId)))
    .limit(1);
  return row ?? null;
}

export async function deleteBillAttachment(id: number) {
  const db = getDb();
  await db.delete(billAttachments).where(eq(billAttachments.id, id));
}
