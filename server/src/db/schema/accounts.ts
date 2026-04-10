import { mysqlTable, int, varchar, boolean, timestamp, text } from 'drizzle-orm/mysql-core';
import { companies } from './company';

export const accountTypes = mysqlTable('account_types', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  normalBalance: varchar('normal_balance', { length: 10 }).notNull(),
});

export const accounts = mysqlTable('accounts', {
  id: int('id').primaryKey().autoincrement(),
  companyId: int('company_id').notNull().references(() => companies.id),
  accountTypeId: int('account_type_id').notNull().references(() => accountTypes.id),
  parentId: int('parent_id'),
  code: varchar('code', { length: 20 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isSystem: boolean('is_system').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});
