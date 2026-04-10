import { mysqlTable, int, varchar, timestamp, decimal, boolean, text } from 'drizzle-orm/mysql-core';
import { companies } from './company';
import { accounts } from './accounts';
import { journalEntries } from './ledger';

export const bankAccounts = mysqlTable('bank_accounts', {
  id: int('id').primaryKey().autoincrement(),
  companyId: int('company_id').notNull().references(() => companies.id),
  accountId: int('account_id').references(() => accounts.id),
  name: varchar('name', { length: 255 }).notNull(),
  bankName: varchar('bank_name', { length: 255 }),
  accountNumber: varchar('account_number', { length: 50 }),
  routingNumber: varchar('routing_number', { length: 20 }),
  currentBalance: decimal('current_balance', { precision: 15, scale: 2 }).default('0.00').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const bankTransactions = mysqlTable('bank_transactions', {
  id: int('id').primaryKey().autoincrement(),
  bankAccountId: int('bank_account_id').notNull().references(() => bankAccounts.id),
  date: varchar('date', { length: 20 }).notNull(),
  description: text('description').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  type: varchar('type', { length: 10 }).notNull(),
  reconciled: boolean('reconciled').default(false).notNull(),
  matchedJournalEntryId: int('matched_journal_entry_id').references(() => journalEntries.id),
  importedAt: timestamp('imported_at').defaultNow().notNull(),
});

export const reconciliations = mysqlTable('reconciliations', {
  id: int('id').primaryKey().autoincrement(),
  bankAccountId: int('bank_account_id').notNull().references(() => bankAccounts.id),
  statementDate: varchar('statement_date', { length: 20 }).notNull(),
  statementBalance: decimal('statement_balance', { precision: 15, scale: 2 }).notNull(),
  reconciledBalance: decimal('reconciled_balance', { precision: 15, scale: 2 }).default('0.00').notNull(),
  status: varchar('status', { length: 20 }).default('open').notNull(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
