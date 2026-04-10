import { eq, and, isNull, sql } from 'drizzle-orm';
import { getDb } from '../db/connection';
import { accounts, accountTypes, journalEntryLines, journalEntries } from '../db/schema';

export async function findAccountTypes() {
  const db = getDb();
  return db.select().from(accountTypes);
}

export async function findAccountsByCompany(companyId: number) {
  const db = getDb();

  // Get all active accounts with their type info
  const rows = await db
    .select({
      id: accounts.id,
      companyId: accounts.companyId,
      accountTypeId: accounts.accountTypeId,
      typeName: accountTypes.name,
      normalBalance: accountTypes.normalBalance,
      parentId: accounts.parentId,
      code: accounts.code,
      name: accounts.name,
      description: accounts.description,
      isSystem: accounts.isSystem,
      isActive: accounts.isActive,
    })
    .from(accounts)
    .innerJoin(accountTypes, eq(accounts.accountTypeId, accountTypes.id))
    .where(and(eq(accounts.companyId, companyId), isNull(accounts.deletedAt)))
    .orderBy(accounts.code);

  // Get aggregate balances from posted journal entries
  const balances = await db
    .select({
      accountId: journalEntryLines.accountId,
      totalDebits: sql<string>`COALESCE(SUM(${journalEntryLines.debit}), 0)`,
      totalCredits: sql<string>`COALESCE(SUM(${journalEntryLines.credit}), 0)`,
    })
    .from(journalEntryLines)
    .innerJoin(
      journalEntries,
      and(
        eq(journalEntryLines.journalEntryId, journalEntries.id),
        eq(journalEntries.status, 'posted'),
        eq(journalEntries.companyId, companyId)
      )
    )
    .groupBy(journalEntryLines.accountId);

  const balanceMap = new Map(balances.map((b) => [b.accountId, b]));

  return rows.map((row) => {
    const bal = balanceMap.get(row.id);
    const debits = parseFloat(bal?.totalDebits ?? '0');
    const credits = parseFloat(bal?.totalCredits ?? '0');
    const balance = row.normalBalance === 'debit' ? debits - credits : credits - debits;
    return { ...row, balance: balance.toFixed(2) };
  });
}

export async function findAccountById(id: number, companyId: number) {
  const db = getDb();
  const [row] = await db
    .select({
      id: accounts.id,
      companyId: accounts.companyId,
      accountTypeId: accounts.accountTypeId,
      typeName: accountTypes.name,
      normalBalance: accountTypes.normalBalance,
      parentId: accounts.parentId,
      code: accounts.code,
      name: accounts.name,
      description: accounts.description,
      isSystem: accounts.isSystem,
      isActive: accounts.isActive,
    })
    .from(accounts)
    .innerJoin(accountTypes, eq(accounts.accountTypeId, accountTypes.id))
    .where(and(eq(accounts.id, id), eq(accounts.companyId, companyId), isNull(accounts.deletedAt)))
    .limit(1);
  return row || null;
}

export async function createAccount(data: {
  companyId: number;
  accountTypeId: number;
  code: string;
  name: string;
  description?: string;
  parentId?: number;
}) {
  const db = getDb();
  const [result] = await db.insert(accounts).values(data) as any;
  return result.insertId as number;
}

export async function updateAccount(
  id: number,
  companyId: number,
  data: Partial<{ code: string; name: string; description: string; isActive: boolean; parentId: number }>
) {
  const db = getDb();
  await db.update(accounts).set(data).where(and(eq(accounts.id, id), eq(accounts.companyId, companyId)));
}

export async function findAccountByCode(companyId: number, code: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.companyId, companyId), eq(accounts.code, code), isNull(accounts.deletedAt)))
    .limit(1);
  return row?.id ?? null;
}

export async function softDeleteAccount(id: number, companyId: number) {
  const db = getDb();
  await db
    .update(accounts)
    .set({ deletedAt: new Date() })
    .where(and(eq(accounts.id, id), eq(accounts.companyId, companyId), eq(accounts.isSystem, false)));
}

// Creates the standard chart of accounts for a newly created company.
// Relies on account_types being seeded with IDs 1-5 in the standard order.
export async function seedDefaultAccounts(companyId: number) {
  const db = getDb();
  const types = await findAccountTypes();
  const typeMap = Object.fromEntries(types.map((t) => [t.name, t.id]));

  const defaults = [
    // Assets
    { code: '1000', name: 'Cash and Cash Equivalents', typeId: typeMap['Asset'] },
    { code: '1100', name: 'Accounts Receivable', typeId: typeMap['Asset'] },
    { code: '1200', name: 'Inventory', typeId: typeMap['Asset'] },
    { code: '1300', name: 'Prepaid Expenses', typeId: typeMap['Asset'] },
    { code: '1400', name: 'GST/HST Recoverable', typeId: typeMap['Asset'] },
    { code: '1500', name: 'Equipment', typeId: typeMap['Asset'] },
    { code: '1600', name: 'Accumulated Depreciation', typeId: typeMap['Asset'] },
    // Liabilities
    { code: '2000', name: 'Accounts Payable', typeId: typeMap['Liability'] },
    { code: '2100', name: 'Credit Cards Payable', typeId: typeMap['Liability'] },
    { code: '2200', name: 'Payroll Liabilities', typeId: typeMap['Liability'] },
    { code: '2300', name: 'Sales Tax Payable', typeId: typeMap['Liability'] },
    { code: '2400', name: 'Short-Term Loans', typeId: typeMap['Liability'] },
    { code: '2500', name: 'Long-Term Debt', typeId: typeMap['Liability'] },
    // Equity
    { code: '3000', name: "Owner's Equity", typeId: typeMap['Equity'] },
    { code: '3100', name: 'Retained Earnings', typeId: typeMap['Equity'] },
    { code: '3200', name: "Owner's Draw", typeId: typeMap['Equity'] },
    // Revenue
    { code: '4000', name: 'Sales Revenue', typeId: typeMap['Revenue'] },
    { code: '4100', name: 'Service Revenue', typeId: typeMap['Revenue'] },
    { code: '4200', name: 'Other Income', typeId: typeMap['Revenue'] },
    // Expenses
    { code: '5000', name: 'Cost of Goods Sold', typeId: typeMap['Expense'] },
    { code: '5100', name: 'Rent Expense', typeId: typeMap['Expense'] },
    { code: '5200', name: 'Utilities Expense', typeId: typeMap['Expense'] },
    { code: '5300', name: 'Payroll Expense', typeId: typeMap['Expense'] },
    { code: '5400', name: 'Office Supplies', typeId: typeMap['Expense'] },
    { code: '5500', name: 'Marketing & Advertising', typeId: typeMap['Expense'] },
    { code: '5600', name: 'Professional Services', typeId: typeMap['Expense'] },
    { code: '5700', name: 'Insurance Expense', typeId: typeMap['Expense'] },
    { code: '5800', name: 'Depreciation Expense', typeId: typeMap['Expense'] },
    { code: '5900', name: 'Other Expenses', typeId: typeMap['Expense'] },
  ];

  for (const acct of defaults) {
    if (!acct.typeId) continue;
    await db.insert(accounts).values({
      companyId,
      accountTypeId: acct.typeId,
      code: acct.code,
      name: acct.name,
      isSystem: true,
    });
  }
}
