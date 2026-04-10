import { getDb, getPool } from '../connection';
import { accountTypes } from '../schema';
import { logger } from '../../utils/logger';

const ACCOUNT_TYPES = [
  { name: 'Asset',     normalBalance: 'debit'  },
  { name: 'Liability', normalBalance: 'credit' },
  { name: 'Equity',    normalBalance: 'credit' },
  { name: 'Revenue',   normalBalance: 'credit' },
  { name: 'Expense',   normalBalance: 'debit'  },
];

async function seed() {
  logger.info('Running database seeds...');
  const db = getDb();

  // Upsert account types (idempotent)
  for (const type of ACCOUNT_TYPES) {
    await db
      .insert(accountTypes)
      .values(type)
      .onDuplicateKeyUpdate({ set: { normalBalance: type.normalBalance } });
  }
  logger.info('Seeded account_types');

  logger.info('Seeding complete');
  const pool = getPool();
  await pool.end();
}

seed().catch((error) => {
  logger.error('Seed failed', { error });
  process.exit(1);
});
