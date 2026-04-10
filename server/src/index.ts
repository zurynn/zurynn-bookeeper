import { config } from './config';
import app from './app';
import { logger } from './utils/logger';
import { getPool } from './db/connection';
import { runMigrations } from './db/migrate';

async function main() {
  // Test DB connection
  try {
    const pool = getPool();
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    logger.info('Database connection established');
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    process.exit(1);
  }

  // Run migrations automatically on startup
  try {
    await runMigrations();
  } catch (error) {
    logger.error('Migrations failed', { error });
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} in ${config.env} mode`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
}

main().catch((error) => {
  logger.error('Fatal error during startup', { error });
  process.exit(1);
});
