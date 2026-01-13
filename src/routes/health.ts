import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

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
    database: 'ok' | 'error' | 'not_configured';
    redis: 'ok' | 'error' | 'not_configured';
  };
}

/**
 * Register health check routes
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /health
   * Basic health check endpoint for load balancers
   */
  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const response: HealthCheckResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.1.0',
      uptime: process.uptime(),
      checks: {
        // Will be updated when we add database/redis
        database: 'not_configured',
        redis: 'not_configured',
      },
    };

    // Determine overall status based on checks
    const hasError = Object.values(response.checks).some(v => v === 'error');
    const allOk = Object.values(response.checks).every(v => v === 'ok' || v === 'not_configured');

    if (hasError) {
      response.status = 'unhealthy';
      return reply.status(503).send(response);
    }

    if (!allOk) {
      response.status = 'degraded';
    }

    return reply.send(response);
  });

  /**
   * GET /health/ready
   * Readiness probe - checks if app can serve traffic
   */
  app.get('/health/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    // TODO: Check database and redis connections
    return reply.send({ ready: true });
  });

  /**
   * GET /health/live
   * Liveness probe - checks if app is running
   */
  app.get('/health/live', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ live: true });
  });
}
