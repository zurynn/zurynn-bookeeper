import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

export default {
  schema: './src/db/schema/*',
  out: './src/db/migrations',
  driver: 'mysql2',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'zurynn',
    password: process.env.DB_PASSWORD || 'zurynn_password',
    database: process.env.DB_NAME || 'zurynn_bookkeeper',
  },
} satisfies Config;
