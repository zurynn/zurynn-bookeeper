import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';

export async function runMigrations(): Promise<void> {
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
  });

  try {
    // Create migration tracking table if it doesn't exist
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [rows] = await conn.execute('SELECT filename FROM _migrations');
    const done = new Set((rows as any[]).map((r: any) => r.filename));

    const dir = path.resolve(__dirname, 'migrations');
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (done.has(file)) {
        logger.info(`Migration already applied: ${file}`);
        continue;
      }
      logger.info(`Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
      await conn.query(sql);
      await conn.execute('INSERT INTO _migrations (filename) VALUES (?)', [file]);
      logger.info(`Migration applied: ${file}`);
    }

    logger.info('Database is up to date');
  } finally {
    await conn.end();
  }
}

// Standalone script entry point: npm run db:migrate
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Migration failed', { error: err });
      process.exit(1);
    });
}
