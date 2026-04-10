import { mysqlTable, int, varchar, timestamp, boolean, json } from 'drizzle-orm/mysql-core';
import { companies } from './company';
import { accounts } from './accounts';

export const recurringTemplates = mysqlTable('recurring_templates', {
  id: int('id').primaryKey().autoincrement(),
  companyId: int('company_id').notNull().references(() => companies.id),
  type: varchar('type', { length: 20 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  frequency: varchar('frequency', { length: 20 }).notNull(),
  nextRunAt: timestamp('next_run_at').notNull(),
  templateData: json('template_data').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const autoCategorization = mysqlTable('auto_categorization_rules', {
  id: int('id').primaryKey().autoincrement(),
  companyId: int('company_id').notNull().references(() => companies.id),
  keyword: varchar('keyword', { length: 255 }).notNull(),
  accountId: int('account_id').notNull().references(() => accounts.id),
  priority: int('priority').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
