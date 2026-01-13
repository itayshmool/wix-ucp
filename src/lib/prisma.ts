import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

/**
 * Prisma client singleton
 * - Logs queries in development
 * - Connection pooling handled by Prisma
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const isDevelopment = process.env.NODE_ENV === 'development';

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDevelopment
      ? ['query', 'error', 'warn']
      : ['error'],
  });

// Prevent multiple instances in development (hot reload)
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Connect to database
 * Call this on server startup
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL database');
  } catch (error) {
    logger.fatal({ error }, 'Failed to connect to database');
    throw error;
  }
}

/**
 * Disconnect from database
 * Call this on server shutdown
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Disconnected from PostgreSQL database');
}

export type { PrismaClient };
