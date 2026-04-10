import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { config } from '../config';
import { logger } from '../utils/logger';
import * as schema from './schema';

let pool: mysql.Pool;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
    logger.info('MySQL connection pool created');
  }
  return pool;
}

export function getDb() {
  return drizzle(getPool(), { schema, mode: 'default' });
}

export type DB = ReturnType<typeof getDb>;
