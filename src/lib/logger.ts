import pino, { type LoggerOptions } from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Logger options - handle undefined transport properly
 */
const loggerOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (isDevelopment ? 'debug' : 'info'),
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
    req: (req) => ({
      method: req.method,
      url: req.url,
      path: req.routeOptions?.url,
      parameters: req.params,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
};

// Add transport only in development (not in test or production)
if (isDevelopment && !isTest) {
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
  };
}

/**
 * Application logger using Pino
 * - Pretty printing in development
 * - JSON format in production
 * - Silent in tests (based on LOG_LEVEL)
 * - Redacts sensitive fields
 */
export const logger = pino(loggerOptions);

export type Logger = typeof logger;
