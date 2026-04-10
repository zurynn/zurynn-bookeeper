import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { Decimal } from 'decimal.js';
import { getDb } from '../db/connection';
import { invoices, invoiceItems, payments, customers } from '../db/schema';
import { journalEntries, journalEntryLines } from '../db/schema/ledger';
import { AppError } from '../middlewares/errorHandler';
import { findAccountByCode } from './accountRepository';
import { updateCustomerBalance } from './customerRepository';

export interface InvoiceItemInput {
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
}

function computeItemAmount(qty: string, price: string): Decimal {
  return new Decimal(qty).times(new Decimal(price));
}

function computeTotals(items: InvoiceItemInput[]) {
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

async function nextInvoiceNumber(companyId: number): Promise<string> {
  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(invoices)
    .where(eq(invoices.companyId, companyId));
  const num = (Number(count) + 1).toString().padStart(4, '0');
  return `INV-${num}`;
}

export async function listInvoices(companyId: number, page = 1, limit = 50) {
  const db = getDb();
  const offset = (page - 1) * limit;
  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      customerId: invoices.customerId,
      customerName: customers.name,
      date: invoices.date,
      dueDate: invoices.dueDate,
      status: invoices.status,
      subtotal: invoices.subtotal,
      taxAmount: invoices.taxAmount,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(eq(invoices.companyId, companyId), isNull(invoices.deletedAt)))
    .orderBy(desc(invoices.date), desc(invoices.id))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(invoices)
    .where(and(eq(invoices.companyId, companyId), isNull(invoices.deletedAt)));

  return { invoices: rows, total: Number(count), page, limit };
}

export async function findInvoiceWithItems(id: number, companyId: number) {
  const db = getDb();
  const [invoice] = await db
    .select({
      id: invoices.id,
      companyId: invoices.companyId,
      customerId: invoices.customerId,
      customerName: customers.name,
      invoiceNumber: invoices.invoiceNumber,
      date: invoices.date,
      dueDate: invoices.dueDate,
      status: invoices.status,
      subtotal: invoices.subtotal,
      taxAmount: invoices.taxAmount,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      notes: invoices.notes,
      terms: invoices.terms,
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(eq(invoices.id, id), eq(invoices.companyId, companyId), isNull(invoices.deletedAt)))
    .limit(1);
  if (!invoice) return null;

  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  const invoicePayments = await db.select().from(payments).where(eq(payments.invoiceId, id));

  return { ...invoice, items, payments: invoicePayments };
}

export async function createInvoice(
  companyId: number,
  data: { customerId: number; date: string; dueDate: string; notes?: string; terms?: string },
  items: InvoiceItemInput[]
) {
  const db = getDb();
  const totals = computeTotals(items);
  const invoiceNumber = await nextInvoiceNumber(companyId);

  const [result] = await db.insert(invoices).values({
    companyId,
    invoiceNumber,
    status: 'draft',
    ...data,
    ...totals,
  }) as any;
  const invoiceId = result.insertId as number;

  if (items.length > 0) {
    await db.insert(invoiceItems).values(
      items.map((item) => ({
        invoiceId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        amount: computeItemAmount(item.quantity, item.unitPrice).toFixed(2),
      }))
    );
  }

  return invoiceId;
}

export async function updateInvoice(
  id: number,
  companyId: number,
  data: Partial<{ customerId: number; date: string; dueDate: string; notes: string; terms: string }>,
  items?: InvoiceItemInput[]
) {
  const db = getDb();
  const existing = await findInvoiceWithItems(id, companyId);
  if (!existing) throw new AppError(404, 'Invoice not found', 'NOT_FOUND');
  if (existing.status !== 'draft') throw new AppError(400, 'Only draft invoices can be edited', 'NOT_DRAFT');

  const updateData: Record<string, any> = { ...data };
  if (items) {
    const totals = computeTotals(items);
    Object.assign(updateData, totals);
    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    if (items.length > 0) {
      await db.insert(invoiceItems).values(
        items.map((item) => ({
          invoiceId: id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          amount: computeItemAmount(item.quantity, item.unitPrice).toFixed(2),
        }))
      );
    }
  }

  await db.update(invoices).set(updateData).where(and(eq(invoices.id, id), eq(invoices.companyId, companyId)));
}

export async function sendInvoice(id: number, companyId: number, createdBy: number) {
  const db = getDb();
  const invoice = await findInvoiceWithItems(id, companyId);
  if (!invoice) throw new AppError(404, 'Invoice not found', 'NOT_FOUND');
  if (invoice.status !== 'draft') throw new AppError(400, 'Invoice is already sent', 'NOT_DRAFT');
  if (invoice.items.length === 0) throw new AppError(400, 'Cannot send invoice with no items', 'NO_ITEMS');

  // Update status
  await db.update(invoices).set({ status: 'sent' }).where(eq(invoices.id, id));

  // Update customer balance
  await updateCustomerBalance(invoice.customerId, companyId, invoice.total);

  // Auto journal entry: DR Accounts Receivable / CR Sales Revenue / CR Tax Payable
  const arId = await findAccountByCode(companyId, '1100');
  const revenueId = await findAccountByCode(companyId, '4000');
  const taxId = await findAccountByCode(companyId, '2300');

  if (arId && revenueId) {
    const [jeResult] = await db.insert(journalEntries).values({
      companyId,
      date: invoice.date,
      description: `Invoice ${invoice.invoiceNumber} — ${invoice.customerName}`,
      reference: invoice.invoiceNumber,
      status: 'posted',
      createdBy,
    }) as any;
    const jeId = jeResult.insertId as number;

    const lines: { journalEntryId: number; accountId: number; debit: string; credit: string }[] = [
      { journalEntryId: jeId, accountId: arId, debit: invoice.total, credit: '0.00' },
      { journalEntryId: jeId, accountId: revenueId, debit: '0.00', credit: invoice.subtotal },
    ];
    if (taxId && parseFloat(invoice.taxAmount) > 0) {
      lines.push({ journalEntryId: jeId, accountId: taxId, debit: '0.00', credit: invoice.taxAmount });
    }
    await db.insert(journalEntryLines).values(lines);
    await db.update(invoices).set({ journalEntryId: jeId }).where(eq(invoices.id, id));
  }
}

export async function recordInvoicePayment(
  id: number,
  companyId: number,
  createdBy: number,
  data: { date: string; amount: string; method: string; reference?: string; notes?: string }
) {
  const db = getDb();
  const invoice = await findInvoiceWithItems(id, companyId);
  if (!invoice) throw new AppError(404, 'Invoice not found', 'NOT_FOUND');
  if (invoice.status === 'draft') throw new AppError(400, 'Invoice must be sent before recording payment', 'NOT_SENT');
  if (invoice.status === 'paid') throw new AppError(400, 'Invoice is already fully paid', 'ALREADY_PAID');

  const remaining = new Decimal(invoice.total).minus(new Decimal(invoice.amountPaid));
  const payAmt = new Decimal(data.amount);
  if (payAmt.greaterThan(remaining)) {
    throw new AppError(400, `Payment exceeds remaining balance of ${remaining.toFixed(2)}`, 'OVERPAYMENT');
  }

  // Auto journal entry: DR Cash / CR Accounts Receivable
  let jeId: number | undefined;
  const cashId = await findAccountByCode(companyId, '1000');
  const arId = await findAccountByCode(companyId, '1100');
  if (cashId && arId) {
    const [jeResult] = await db.insert(journalEntries).values({
      companyId,
      date: data.date,
      description: `Payment on Invoice ${invoice.invoiceNumber} — ${invoice.customerName}`,
      reference: data.reference ?? invoice.invoiceNumber,
      status: 'posted',
      createdBy,
    }) as any;
    jeId = jeResult.insertId as number;
    await db.insert(journalEntryLines).values([
      { journalEntryId: jeId, accountId: cashId, debit: data.amount, credit: '0.00' },
      { journalEntryId: jeId, accountId: arId, debit: '0.00', credit: data.amount },
    ]);
  }

  // Insert payment record
  await db.insert(payments).values({ companyId, invoiceId: id, journalEntryId: jeId ?? null, ...data });

  // Update invoice amountPaid and status
  const newPaid = new Decimal(invoice.amountPaid).plus(payAmt);
  const newStatus = newPaid.greaterThanOrEqualTo(new Decimal(invoice.total)) ? 'paid' : 'partial';
  await db.update(invoices)
    .set({ amountPaid: newPaid.toFixed(2), status: newStatus })
    .where(eq(invoices.id, id));

  // Update customer balance
  await updateCustomerBalance(invoice.customerId, companyId, payAmt.negated().toFixed(2));
}

export async function voidInvoice(id: number, companyId: number) {
  const db = getDb();
  const invoice = await findInvoiceWithItems(id, companyId);
  if (!invoice) throw new AppError(404, 'Invoice not found', 'NOT_FOUND');
  if (invoice.status === 'paid') throw new AppError(400, 'Paid invoices cannot be voided', 'ALREADY_PAID');

  await db.update(invoices).set({ deletedAt: new Date() }).where(eq(invoices.id, id));
  if (['sent', 'partial'].includes(invoice.status)) {
    const outstanding = new Decimal(invoice.total).minus(new Decimal(invoice.amountPaid));
    await updateCustomerBalance(invoice.customerId, companyId, outstanding.negated().toFixed(2));
  }
}
