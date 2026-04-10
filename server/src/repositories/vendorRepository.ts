import { eq, and, isNull, sql } from 'drizzle-orm';
import { getDb } from '../db/connection';
import { vendors, bills } from '../db/schema';

export async function listVendors(companyId: number) {
  const db = getDb();
  return db
    .select()
    .from(vendors)
    .where(and(eq(vendors.companyId, companyId), isNull(vendors.deletedAt)))
    .orderBy(vendors.name);
}

export async function findVendorById(id: number, companyId: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.id, id), eq(vendors.companyId, companyId), isNull(vendors.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function createVendor(data: {
  companyId: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  notes?: string;
}) {
  const db = getDb();
  const [result] = await db.insert(vendors).values(data) as any;
  return result.insertId as number;
}

export async function updateVendor(
  id: number,
  companyId: number,
  data: Partial<{
    name: string; email: string; phone: string; address: string;
    city: string; state: string; country: string; notes: string;
  }>
) {
  const db = getDb();
  await db.update(vendors).set(data).where(and(eq(vendors.id, id), eq(vendors.companyId, companyId)));
}

export async function updateVendorBalance(id: number, companyId: number, delta: string) {
  const db = getDb();
  await db
    .update(vendors)
    .set({ balanceOwed: sql`balance_owed + ${delta}` })
    .where(and(eq(vendors.id, id), eq(vendors.companyId, companyId)));
}

export async function softDeleteVendor(id: number, companyId: number) {
  const db = getDb();
  await db
    .update(vendors)
    .set({ deletedAt: new Date() })
    .where(and(eq(vendors.id, id), eq(vendors.companyId, companyId)));
}
