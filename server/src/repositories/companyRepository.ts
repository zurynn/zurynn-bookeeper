import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/connection';
import { companies, companyUsers, taxSettings, fiscalYears } from '../db/schema';
import { users } from '../db/schema/auth';

export async function findUserCompany(userId: number) {
  const db = getDb();
  const [result] = await db
    .select({
      id: companies.id,
      name: companies.name,
      currency: companies.currency,
      fiscalYearStart: companies.fiscalYearStart,
    })
    .from(companyUsers)
    .innerJoin(companies, eq(companyUsers.companyId, companies.id))
    .where(eq(companyUsers.userId, userId))
    .limit(1);
  return result || null;
}

export async function findCompanyById(id: number) {
  const db = getDb();
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, id))
    .limit(1);
  return company || null;
}

export async function createCompany(data: {
  name: string;
  currency?: string;
  fiscalYearStart?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  const db = getDb();
  const [result] = await db.insert(companies).values(data) as any;
  return result.insertId;
}

export async function addUserToCompany(data: {
  companyId: number;
  userId: number;
  role: string;
  acceptedAt?: Date;
}) {
  const db = getDb();
  await db.insert(companyUsers).values({
    ...data,
    acceptedAt: data.acceptedAt || new Date(),
  });
}

export async function findCompanyMembers(companyId: number) {
  const db = getDb();
  return db
    .select({
      userId: companyUsers.userId,
      role: companyUsers.role,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      invitedAt: companyUsers.invitedAt,
      acceptedAt: companyUsers.acceptedAt,
    })
    .from(companyUsers)
    .innerJoin(users, eq(companyUsers.userId, users.id))
    .where(eq(companyUsers.companyId, companyId));
}

export async function updateCompany(id: number, data: Partial<{
  name: string;
  currency: string;
  fiscalYearStart: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  industry: string;
}>) {
  const db = getDb();
  await db.update(companies).set(data).where(eq(companies.id, id));
}

export async function getUserCompanies(userId: number) {
  const db = getDb();
  return db
    .select({
      id: companies.id,
      name: companies.name,
      currency: companies.currency,
      role: companyUsers.role,
    })
    .from(companyUsers)
    .innerJoin(companies, eq(companyUsers.companyId, companies.id))
    .where(eq(companyUsers.userId, userId));
}

export async function removeMemberFromCompany(companyId: number, userId: number) {
  const db = getDb();
  await db
    .delete(companyUsers)
    .where(and(eq(companyUsers.companyId, companyId), eq(companyUsers.userId, userId)));
}

export async function findTaxSettings(companyId: number) {
  const db = getDb();
  return db.select().from(taxSettings).where(eq(taxSettings.companyId, companyId));
}

export async function createTaxSetting(data: {
  companyId: number;
  taxName: string;
  taxRate: string;
  appliesTo?: string;
  recoverablePercentage?: string;
  recoverableAccountId?: number | null;
  liabilityAccountId?: number | null;
}) {
  const db = getDb();
  const [result] = await db.insert(taxSettings).values(data) as any;
  return result.insertId as number;
}

export async function updateTaxSetting(id: number, companyId: number, data: Partial<{
  taxName: string;
  taxRate: string;
  appliesTo: string;
  isActive: boolean;
  recoverablePercentage: string;
  recoverableAccountId: number | null;
  liabilityAccountId: number | null;
}>) {
  const db = getDb();
  await db.update(taxSettings).set(data).where(and(eq(taxSettings.id, id), eq(taxSettings.companyId, companyId)));
}

export async function deleteTaxSetting(id: number, companyId: number) {
  const db = getDb();
  await db.delete(taxSettings).where(and(eq(taxSettings.id, id), eq(taxSettings.companyId, companyId)));
}

export async function findFiscalYears(companyId: number) {
  const db = getDb();
  return db.select().from(fiscalYears).where(eq(fiscalYears.companyId, companyId));
}
