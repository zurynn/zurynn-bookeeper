import { mysqlTable, int, varchar, timestamp, decimal, boolean, text } from 'drizzle-orm/mysql-core';
import { users } from './auth';

export const companies = mysqlTable('companies', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  website: varchar('website', { length: 255 }),
  currency: varchar('currency', { length: 10 }).default('USD').notNull(),
  fiscalYearStart: varchar('fiscal_year_start', { length: 10 }).default('01-01').notNull(),
  industry: varchar('industry', { length: 100 }),
  logoUrl: varchar('logo_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const companyUsers = mysqlTable('company_users', {
  id: int('id').primaryKey().autoincrement(),
  companyId: int('company_id').notNull().references(() => companies.id),
  userId: int('user_id').notNull().references(() => users.id),
  role: varchar('role', { length: 50 }).default('staff').notNull(),
  invitedAt: timestamp('invited_at').defaultNow().notNull(),
  acceptedAt: timestamp('accepted_at'),
});

export const fiscalYears = mysqlTable('fiscal_years', {
  id: int('id').primaryKey().autoincrement(),
  companyId: int('company_id').notNull().references(() => companies.id),
  startDate: varchar('start_date', { length: 20 }).notNull(),
  endDate: varchar('end_date', { length: 20 }).notNull(),
  closed: boolean('closed').default(false).notNull(),
  closedAt: timestamp('closed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const taxSettings = mysqlTable('tax_settings', {
  id: int('id').primaryKey().autoincrement(),
  companyId: int('company_id').notNull().references(() => companies.id),
  taxName: varchar('tax_name', { length: 100 }).notNull(),
  taxRate: decimal('tax_rate', { precision: 6, scale: 4 }).notNull(),
  // Recoverable percentage (1.0000 = 100% recoverable, 0.5000 = 50%)
  recoverablePercentage: decimal('recoverable_percentage', { precision: 5, scale: 4 }).default('1.0000').notNull(),
  // FK to accounts — stored as bare int to avoid circular import with accounts.ts
  recoverableAccountId: int('recoverable_account_id'),
  liabilityAccountId: int('liability_account_id'),
  appliesTo: varchar('applies_to', { length: 50 }).default('both').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
