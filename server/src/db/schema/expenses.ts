import { mysqlTable, int, varchar, timestamp, decimal, text } from 'drizzle-orm/mysql-core';
import { companies, taxSettings } from './company';
import { accounts } from './accounts';
import { vendors } from './billing';
import { journalEntries } from './ledger';
import { users } from './auth';

export const expenses = mysqlTable('expenses', {
  id: int('id').primaryKey().autoincrement(),
  companyId: int('company_id').notNull().references(() => companies.id),
  expenseNumber: varchar('expense_number', { length: 50 }).notNull(),
  vendorId: int('vendor_id').references(() => vendors.id),
  paymentAccountId: int('payment_account_id').notNull().references(() => accounts.id),
  date: varchar('date', { length: 20 }).notNull(),
  description: text('description').notNull(),
  status: varchar('status', { length: 20 }).default('draft').notNull(),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).default('0.00').notNull(),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  total: decimal('total', { precision: 15, scale: 2 }).default('0.00').notNull(),
  journalEntryId: int('journal_entry_id').references(() => journalEntries.id),
  postedAt: timestamp('posted_at'),
  voidedAt: timestamp('voided_at'),
  notes: text('notes'),
  createdBy: int('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const expenseLines = mysqlTable('expense_lines', {
  id: int('id').primaryKey().autoincrement(),
  expenseId: int('expense_id').notNull().references(() => expenses.id),
  expenseAccountId: int('expense_account_id').notNull().references(() => accounts.id),
  description: text('description').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  taxCodeId: int('tax_code_id').references(() => taxSettings.id),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
});

export const expenseAttachments = mysqlTable('expense_attachments', {
  id: int('id').primaryKey().autoincrement(),
  expenseId: int('expense_id').notNull().references(() => expenses.id),
  companyId: int('company_id').notNull().references(() => companies.id),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  storedName: varchar('stored_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  size: int('size').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
