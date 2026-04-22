import { mysqlTable, int, varchar, decimal, timestamp } from 'drizzle-orm/mysql-core';
import { companies } from './company';
import { users } from './auth';
import { journalEntries } from './ledger';

export const simpleTransactions = mysqlTable('simple_transactions', {
  id: int('id').primaryKey().autoincrement(),
  companyId: int('company_id').notNull().references(() => companies.id),
  type: varchar('type', { length: 10 }).notNull(), // 'income' | 'expense'
  date: varchar('date', { length: 20 }).notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  accountCode: varchar('account_code', { length: 20 }).notNull(),
  journalEntryId: int('journal_entry_id').references(() => journalEntries.id),
  createdBy: int('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});
