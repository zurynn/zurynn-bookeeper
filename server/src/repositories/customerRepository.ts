import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { getDb } from '../db/connection';
import { customers, invoices } from '../db/schema';

export async function listCustomers(companyId: number) {
  const db = getDb();
  return db
    .select()
    .from(customers)
    .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt)))
    .orderBy(customers.name);
}

export async function findCustomerById(id: number, companyId: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.companyId, companyId), isNull(customers.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function createCustomer(data: {
  companyId: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  currency?: string;
  notes?: string;
}) {
  const db = getDb();
  const [result] = await db.insert(customers).values(data) as any;
  return result.insertId as number;
}

export async function updateCustomer(
  id: number,
  companyId: number,
  data: Partial<{
    name: string; email: string; phone: string; address: string;
    city: string; state: string; country: string; currency: string; notes: string;
  }>
) {
  const db = getDb();
  await db.update(customers).set(data).where(and(eq(customers.id, id), eq(customers.companyId, companyId)));
}

export async function updateCustomerBalance(id: number, companyId: number, delta: string) {
  const db = getDb();
  await db
    .update(customers)
    .set({ balanceDue: sql`balance_due + ${delta}` })
    .where(and(eq(customers.id, id), eq(customers.companyId, companyId)));
}

export async function softDeleteCustomer(id: number, companyId: number) {
  const db = getDb();
  await db
    .update(customers)
    .set({ deletedAt: new Date() })
    .where(and(eq(customers.id, id), eq(customers.companyId, companyId)));
}

export async function getCustomerInvoiceSummary(customerId: number, companyId: number) {
  const db = getDb();
  const rows = await db
    .select({
      status: invoices.status,
      count: sql<number>`COUNT(*)`,
      total: sql<string>`COALESCE(SUM(${invoices.total}), 0)`,
    })
    .from(invoices)
    .where(and(eq(invoices.customerId, customerId), eq(invoices.companyId, companyId), isNull(invoices.deletedAt)))
    .groupBy(invoices.status);
  return rows;
}
