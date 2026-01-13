import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { getRedis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

/**
 * Health check response structure
 * Used by Render for health monitoring
 */
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
  };
}

/**
 * Check database connection
 */
async function checkDatabase(): Promise<'ok' | 'error'> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'ok';
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return 'error';
  }
}

/**
 * Check Redis connection
 */
async function checkRedis(): Promise<'ok' | 'error'> {
  try {
    const redis = getRedis();
    await redis.ping();
    return 'ok';
  } catch (error) {
    logger.error({ error }, 'Redis health check failed');
    return 'error';
  }
}

/**
 * Register health check routes
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /health
   * Full health check endpoint for load balancers
   * Checks database and Redis connections
   */
  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Run checks in parallel
    const [dbStatus, redisStatus] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);

    const response: HealthCheckResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.1.0',
      uptime: process.uptime(),
      checks: {
        database: dbStatus,
        redis: redisStatus,
      },
    };

    // Determine overall status based on checks
    const hasError = dbStatus === 'error' || redisStatus === 'error';

    if (hasError) {
      response.status = 'unhealthy';
      return reply.status(503).send(response);
    }

    return reply.send(response);
  });

  /**
   * GET /health/ready
   * Readiness probe - checks if app can serve traffic
   * Used by Kubernetes/Render to determine if traffic should be routed
   */
  app.get('/health/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    const [dbStatus, redisStatus] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);

    const ready = dbStatus === 'ok' && redisStatus === 'ok';

    if (!ready) {
      return reply.status(503).send({ 
        ready: false,
        checks: { database: dbStatus, redis: redisStatus }
      });
    }

    return reply.send({ ready: true });
  });

  /**
   * GET /health/live
   * Liveness probe - checks if app process is running
   * Should always return 200 if the process is alive
   */
  app.get('/health/live', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ live: true });
  });
}
