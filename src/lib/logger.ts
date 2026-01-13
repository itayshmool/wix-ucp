import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Application logger using Pino
 * - Pretty printing in development
 * - JSON format in production
 * - Redacts sensitive fields
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'payload.credential',
      'payload.token',
      'payload.password',
      '*.cardNumber',
      '*.cvv',
      '*.pan',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    req: req => ({
      method: req.method,
      url: req.url,
      path: req.routeOptions?.url,
      parameters: req.params,
    }),
    res: res => ({
      statusCode: res.statusCode,
    }),
  },
});

export type Logger = typeof logger;
