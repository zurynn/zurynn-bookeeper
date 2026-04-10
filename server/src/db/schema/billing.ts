import { mysqlTable, int, varchar, timestamp, decimal, text } from 'drizzle-orm/mysql-core';
import { companies } from './company';
import { journalEntries } from './ledger';

export const vendors = mysqlTable('vendors', {
  id: int('id').primaryKey().autoincrement(),
  companyId: int('company_id').notNull().references(() => companies.id),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  country: varchar('country', { length: 100 }).default('US'),
  balanceOwed: decimal('balance_owed', { precision: 15, scale: 2 }).default('0.00').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const bills = mysqlTable('bills', {
  id: int('id').primaryKey().autoincrement(),
  companyId: int('company_id').notNull().references(() => companies.id),
  vendorId: int('vendor_id').notNull().references(() => vendors.id),
  billNumber: varchar('bill_number', { length: 50 }).notNull(),
  date: varchar('date', { length: 20 }).notNull(),
  dueDate: varchar('due_date', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).default('draft').notNull(),
  subtotal: decimal('subtotal', { precision: 15, scale: 2 }).default('0.00').notNull(),
  taxAmount: decimal('tax_amount', { precision: 15, scale: 2 }).default('0.00').notNull(),
  total: decimal('total', { precision: 15, scale: 2 }).default('0.00').notNull(),
  amountPaid: decimal('amount_paid', { precision: 15, scale: 2 }).default('0.00').notNull(),
  notes: text('notes'),
  journalEntryId: int('journal_entry_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const billItems = mysqlTable('bill_items', {
  id: int('id').primaryKey().autoincrement(),
  billId: int('bill_id').notNull().references(() => bills.id),
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).default('1.00').notNull(),
  unitPrice: decimal('unit_price', { precision: 15, scale: 2 }).notNull(),
  taxRate: decimal('tax_rate', { precision: 6, scale: 4 }).default('0.0000').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
});

export const billPayments = mysqlTable('bill_payments', {
  id: int('id').primaryKey().autoincrement(),
  companyId: int('company_id').notNull().references(() => companies.id),
  billId: int('bill_id').notNull().references(() => bills.id),
  date: varchar('date', { length: 20 }).notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  method: varchar('method', { length: 20 }).default('bank').notNull(),
  reference: varchar('reference', { length: 100 }),
  notes: text('notes'),
  journalEntryId: int('journal_entry_id').references(() => journalEntries.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const billAttachments = mysqlTable('bill_attachments', {
  id: int('id').primaryKey().autoincrement(),
  billId: int('bill_id').notNull().references(() => bills.id),
  companyId: int('company_id').notNull().references(() => companies.id),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  storedName: varchar('stored_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  size: int('size').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
