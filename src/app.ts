import Fastify, { type FastifyInstance, type FastifyError, type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { logger } from './lib/logger.js';
import { healthRoutes } from './routes/health.js';
import { RATE_LIMITS } from './config/index.js';

/**
 * Build and configure Fastify application
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger,
    trustProxy: true, // Required for Render (behind proxy)
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  // ─────────────────────────────────────────────────────────────
  // Security Plugins
  // ─────────────────────────────────────────────────────────────

  // CORS
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    maxAge: 86400, // 24 hours
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: RATE_LIMITS.DEFAULT.max,
    timeWindow: RATE_LIMITS.DEFAULT.timeWindow,
    errorResponseBuilder: (_request, context) => ({
      error: 'RATE_LIMITED',
      message: 'Too many requests, please try again later',
      retryAfter: Math.ceil(context.ttl / 1000),
    }),
  });

  // Cookie support (for session tokens)
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret) {
    await app.register(cookie, {
      secret: jwtSecret,
      hook: 'onRequest',
      parseOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Routes
  // ─────────────────────────────────────────────────────────────

  // Health check routes (no auth required)
  await app.register(healthRoutes);

  // UCP API routes will be registered here
  // await app.register(ucpRoutes, { prefix: '/ucp/v1' });

  // ─────────────────────────────────────────────────────────────
  // Error Handling
  // ─────────────────────────────────────────────────────────────

  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // Log full error server-side
    request.log.error({
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
      },
      url: request.url,
      method: request.method,
    });

    // Determine status code
    const statusCode = error.statusCode ?? 500;

    // Send sanitized error to client
    reply.status(statusCode).send({
      error: statusCode >= 500 ? 'INTERNAL_ERROR' : error.code ?? 'ERROR',
      message: statusCode >= 500 
        ? 'Internal server error' 
        : error.message,
      // Only include details in development
      ...(process.env.NODE_ENV === 'development' && {
        details: error.message,
      }),
    });
  });

  // 404 handler
  app.setNotFoundHandler((_request: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({
      error: 'NOT_FOUND',
      message: 'The requested resource was not found',
    });
  });

  return app;
}
