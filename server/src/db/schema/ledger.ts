import { mysqlTable, int, varchar, timestamp, decimal, text, boolean } from 'drizzle-orm/mysql-core';
import { companies } from './company';
import { accounts } from './accounts';
import { users } from './auth';

export const journalEntries = mysqlTable('journal_entries', {
  id: int('id').primaryKey().autoincrement(),
  companyId: int('company_id').notNull().references(() => companies.id),
  date: varchar('date', { length: 20 }).notNull(),
  description: text('description').notNull(),
  reference: varchar('reference', { length: 100 }),
  status: varchar('status', { length: 20 }).default('draft').notNull(),
  reversalOfId: int('reversal_of_id'),
  createdBy: int('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const journalEntryLines = mysqlTable('journal_entry_lines', {
  id: int('id').primaryKey().autoincrement(),
  journalEntryId: int('journal_entry_id').notNull().references(() => journalEntries.id),
  accountId: int('account_id').notNull().references(() => accounts.id),
  debit: decimal('debit', { precision: 15, scale: 2 }).default('0.00').notNull(),
  credit: decimal('credit', { precision: 15, scale: 2 }).default('0.00').notNull(),
  memo: text('memo'),
});

export const auditLogs = mysqlTable('audit_logs', {
  id: int('id').primaryKey().autoincrement(),
  companyId: int('company_id').references(() => companies.id),
  userId: int('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: varchar('entity_id', { length: 100 }),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
