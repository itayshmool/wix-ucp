import Redis from 'ioredis';
import { logger } from './logger.js';
import { TTL } from '../config/index.js';

/**
 * Redis key prefixes for different data types
 * As defined in infrastructure/deployment.mdc
 */
export const REDIS_KEYS = {
  /** Payment token: token:{checkoutId}:{tokenId} */
  token: (checkoutId: string, tokenId: string) => `token:${checkoutId}:${tokenId}`,
  
  /** Checkout session: checkout:{checkoutId} */
  checkout: (checkoutId: string) => `checkout:${checkoutId}`,
  
  /** MCP session: mcp:session:{sessionId} */
  mcpSession: (sessionId: string) => `mcp:session:${sessionId}`,
  
  /** Rate limit counter: rate:{clientId}:{endpoint} */
  rateLimit: (clientId: string, endpoint: string) => `rate:${clientId}:${endpoint}`,
  
  /** Cached business profile: cache:profile:{siteId} */
  profileCache: (siteId: string) => `cache:profile:${siteId}`,
  
  /** Idempotency key: idempotency:{key} */
  idempotency: (key: string) => `idempotency:${key}`,
} as const;

/**
 * Redis client singleton
 */
let redis: Redis | null = null;

/**
 * Get or create Redis client
 */
export function getRedis(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.error({ times }, 'Redis connection failed after max retries');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 200, 2000);
        logger.warn({ times, delay }, 'Retrying Redis connection');
        return delay;
      },
      reconnectOnError: (err) => {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        return targetErrors.some(e => err.message.includes(e));
      },
    });

    // Connection events
    redis.on('connect', () => {
      logger.info('Connected to Redis');
    });

    redis.on('ready', () => {
      logger.info('Redis client ready');
    });

    redis.on('error', (err) => {
      logger.error({ error: err.message }, 'Redis error');
    });

    redis.on('close', () => {
      logger.warn('Redis connection closed');
    });

    redis.on('reconnecting', () => {
      logger.info('Reconnecting to Redis');
    });
  }

  return redis;
}

/**
 * Connect to Redis
 * Call this on server startup
 */
export async function connectRedis(): Promise<void> {
  const client = getRedis();
  
  try {
    await client.ping();
    logger.info('Redis connection verified');
  } catch (error) {
    logger.fatal({ error }, 'Failed to connect to Redis');
    throw error;
  }
}

/**
 * Disconnect from Redis
 * Call this on server shutdown
 */
export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    logger.info('Disconnected from Redis');
  }
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Set a value with TTL
 */
export async function setWithTTL<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  const client = getRedis();
  await client.setex(key, ttlSeconds, JSON.stringify(value));
}

/**
 * Get a value and parse as JSON
 */
export async function getJSON<T>(key: string): Promise<T | null> {
  const client = getRedis();
  const value = await client.get(key);
  
  if (!value) {
    return null;
  }
  
  try {
    return JSON.parse(value) as T;
  } catch {
    logger.warn({ key }, 'Failed to parse Redis value as JSON');
    return null;
  }
}

/**
 * Delete a key
 */
export async function deleteKey(key: string): Promise<boolean> {
  const client = getRedis();
  const result = await client.del(key);
  return result > 0;
}

/**
 * Check if a key exists
 */
export async function exists(key: string): Promise<boolean> {
  const client = getRedis();
  const result = await client.exists(key);
  return result > 0;
}

/**
 * Set a value only if it doesn't exist (for idempotency)
 * Returns true if the key was set, false if it already existed
 */
export async function setIfNotExists(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<boolean> {
  const client = getRedis();
  const result = await client.set(key, value, 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

// ─────────────────────────────────────────────────────────────
// Token Storage (Payment Tokens)
// ─────────────────────────────────────────────────────────────

export interface StoredToken {
  id: string;
  wixCardToken: string;
  binding: {
    checkoutId: string;
    businessId: string;
  };
  instrument: {
    type: string;
    brand?: string;
    lastDigits?: string;
    expiryMonth?: string;
    expiryYear?: string;
  };
  createdAt: string;
  expiresAt: string;
  used: boolean;
}

/**
 * Store a payment token
 */
export async function storeToken(
  checkoutId: string,
  tokenId: string,
  token: StoredToken
): Promise<void> {
  const key = REDIS_KEYS.token(checkoutId, tokenId);
  await setWithTTL(key, token, TTL.TOKEN);
}

/**
 * Get a payment token
 */
export async function getToken(
  checkoutId: string,
  tokenId: string
): Promise<StoredToken | null> {
  const key = REDIS_KEYS.token(checkoutId, tokenId);
  return getJSON<StoredToken>(key);
}

/**
 * Mark a token as used (single-use enforcement)
 */
export async function markTokenUsed(
  checkoutId: string,
  tokenId: string
): Promise<boolean> {
  const token = await getToken(checkoutId, tokenId);
  
  if (!token || token.used) {
    return false;
  }
  
  token.used = true;
  const key = REDIS_KEYS.token(checkoutId, tokenId);
  
  // Get remaining TTL and update
  const client = getRedis();
  const ttl = await client.ttl(key);
  
  if (ttl > 0) {
    await setWithTTL(key, token, ttl);
    return true;
  }
  
  return false;
}

/**
 * Delete a token
 */
export async function deleteToken(
  checkoutId: string,
  tokenId: string
): Promise<boolean> {
  const key = REDIS_KEYS.token(checkoutId, tokenId);
  return deleteKey(key);
}

export { Redis };
