import { buildApp } from './app.js';
import { logger } from './lib/logger.js';

/**
 * Main server entry point
 */
async function main(): Promise<void> {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST ?? '0.0.0.0';

  try {
    const app = await buildApp();

    // Graceful shutdown handler
    const shutdown = async (signal: string): Promise<void> => {
      logger.info({ signal }, 'Received shutdown signal, closing server...');
      
      try {
        await app.close();
        logger.info('Server closed gracefully');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Start server
    await app.listen({ port, host });
    
    logger.info({
      port,
      host,
      environment: process.env.NODE_ENV ?? 'development',
    }, '🚀 Wix UCP Integration server started');

  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

main();
