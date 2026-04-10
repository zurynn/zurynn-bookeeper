import { mysqlTable, int, varchar, timestamp, decimal, text, boolean } from 'drizzle-orm/mysql-core';
import { companies } from './company';
import { journalEntries } from './ledger';

export const customers = mysqlTable('customers', {
  id: int('id').primaryKey().autoincrement(),
  companyId: int('company_id').notNull().references(() => companies.id),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  country: varchar('country', { length: 100 }).default('US'),
  currency: varchar('currency', { length: 10 }).default('USD'),
  balanceDue: decimal('balance_due', { precision: 15, scale: 2 }).default('0.00').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const invoices = mysqlTable('invoices', {
  id: int('id').primaryKey().autoincrement(),
  companyId: int('company_id').notNull().references(() => companies.id),
  customerId: int('customer_id').notNull().references(() => customers.id),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  date: varchar('date', { length: 20 }).notNull(),
  dueDate: varchar('due_date', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).default('draft').notNull(),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).default('0.00').notNull(),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  total: decimal('total', { precision: 15, scale: 2 }).default('0.00').notNull(),
  amountPaid: decimal('amount_paid', { precision: 15, scale: 2 }).default('0.00').notNull(),
  notes: text('notes'),
  terms: text('terms'),
  journalEntryId: int('journal_entry_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const invoiceItems = mysqlTable('invoice_items', {
  id: int('id').primaryKey().autoincrement(),
  invoiceId: int('invoice_id').notNull().references(() => invoices.id),
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).default('1.00').notNull(),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  taxRate: decimal('tax_rate', { precision: 6, scale: 4 }).default('0.0000').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
});

export const payments = mysqlTable('payments', {
  id: int('id').primaryKey().autoincrement(),
  companyId: int('company_id').notNull().references(() => companies.id),
  invoiceId: int('invoice_id').notNull().references(() => invoices.id),
  date: varchar('date', { length: 20 }).notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  method: varchar('method', { length: 20 }).default('bank').notNull(),
  reference: varchar('reference', { length: 100 }),
  notes: text('notes'),
  journalEntryId: int('journal_entry_id').references(() => journalEntries.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
