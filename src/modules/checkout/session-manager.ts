/**
 * Checkout Session Manager
 * 
 * Manages checkout session storage and retrieval in Redis.
 * See: .cursor/rules/modules/checkout.mdc
 */

import { randomUUID } from 'crypto';
import { logger } from '../../lib/logger.js';
import {
  getRedis,
  setWithTTL,
  getJSON,
  deleteKey,
  setIfNotExists,
  REDIS_KEYS,
} from '../../lib/redis.js';
import { TTL } from '../../core/constants.js';

// Use CHECKOUT TTL from constants
const CHECKOUT_SESSION_TTL = TTL.CHECKOUT;
import type { StoredCheckoutSession, FulfillmentOption } from './types.js';
import type { Address, Buyer, LineItem } from '../../core/types/ucp-common.js';
import type { CheckoutStatus } from '../../core/types/checkout.js';
import { determineStatus } from './state-machine.js';
import { calculateExpiry } from './cart-mapper.js';

/**
 * Session manager configuration
 */
export interface SessionManagerConfig {
  /** Session TTL in seconds */
  ttlSeconds?: number;
  /** Maximum payment retries */
  maxPaymentRetries?: number;
}

const DEFAULT_CONFIG: Required<SessionManagerConfig> = {
  ttlSeconds: CHECKOUT_SESSION_TTL,
  maxPaymentRetries: 3,
};

/**
 * Checkout Session Manager
 */
export class CheckoutSessionManager {
  private config: Required<SessionManagerConfig>;

  constructor(config: SessionManagerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate a new checkout session ID
   */
  private generateSessionId(): string {
    return `chk_${randomUUID().replace(/-/g, '')}`;
  }

  /**
   * Get Redis key for checkout session
   */
  private getKey(checkoutId: string): string {
    return REDIS_KEYS.checkout(checkoutId);
  }

  /**
   * Create a new checkout session
   */
  async create(params: {
    currency: string;
    buyer?: Buyer;
    lineItems: LineItem[];
    shippingAddress?: Address;
    billingAddress?: Address;
    discountCode?: string;
    metadata?: Record<string, string>;
  }): Promise<StoredCheckoutSession> {
    const id = this.generateSessionId();
    const now = new Date().toISOString();

    const session: StoredCheckoutSession = {
      id,
      status: 'incomplete',
      currency: params.currency,
      buyer: params.buyer,
      lineItems: params.lineItems,
      shippingAddress: params.shippingAddress,
      billingAddress: params.billingAddress,
      discountCode: params.discountCode,
      metadata: params.metadata,
      createdAt: now,
      updatedAt: now,
      expiresAt: calculateExpiry(this.config.ttlSeconds),
    };

    // Determine initial status
    session.status = determineStatus(session);

    // Store in Redis
    await setWithTTL(this.getKey(id), session, this.config.ttlSeconds);

    logger.info(
      { checkoutId: id, status: session.status },
      'Created checkout session'
    );

    return session;
  }

  /**
   * Get a checkout session by ID
   */
  async get(checkoutId: string): Promise<StoredCheckoutSession | null> {
    const session = await getJSON<StoredCheckoutSession>(this.getKey(checkoutId));

    if (!session) {
      return null;
    }

    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
      session.status = 'expired';
    }

    return session;
  }

  /**
   * Update a checkout session
   */
  async update(
    checkoutId: string,
    updates: {
      buyer?: Partial<Buyer>;
      shippingAddress?: Address;
      billingAddress?: Address;
      selectedFulfillmentId?: string;
      discountCode?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<StoredCheckoutSession | null> {
    const session = await this.get(checkoutId);

    if (!session) {
      return null;
    }

    // Check if session can be modified
    if (['completed', 'cancelled', 'expired'].includes(session.status)) {
      logger.warn(
        { checkoutId, status: session.status },
        'Cannot update session in terminal state'
      );
      return null;
    }

    // Apply updates
    if (updates.buyer) {
      session.buyer = { ...session.buyer, ...updates.buyer } as Buyer;
    }
    if (updates.shippingAddress) {
      session.shippingAddress = updates.shippingAddress;
    }
    if (updates.billingAddress) {
      session.billingAddress = updates.billingAddress;
    }
    if (updates.selectedFulfillmentId !== undefined) {
      session.selectedFulfillmentId = updates.selectedFulfillmentId;
    }
    if (updates.discountCode !== undefined) {
      session.discountCode = updates.discountCode;
    }
    if (updates.metadata) {
      session.metadata = { ...session.metadata, ...updates.metadata };
    }

    session.updatedAt = new Date().toISOString();

    // Recalculate status
    session.status = determineStatus(session);

    // Get remaining TTL
    const redis = getRedis();
    const key = this.getKey(checkoutId);
    const ttl = await redis.ttl(key);
    const effectiveTtl = ttl > 0 ? ttl : this.config.ttlSeconds;

    // Save updated session
    await setWithTTL(key, session, effectiveTtl);

    logger.info(
      { checkoutId, status: session.status },
      'Updated checkout session'
    );

    return session;
  }

  /**
   * Set payment transaction ID on session
   */
  async setPaymentTransaction(
    checkoutId: string,
    transactionId: string
  ): Promise<StoredCheckoutSession | null> {
    const session = await this.get(checkoutId);

    if (!session) {
      return null;
    }

    session.paymentTransactionId = transactionId;
    session.updatedAt = new Date().toISOString();
    session.status = determineStatus(session);

    const redis = getRedis();
    const key = this.getKey(checkoutId);
    const ttl = await redis.ttl(key);
    const effectiveTtl = ttl > 0 ? ttl : this.config.ttlSeconds;

    await setWithTTL(key, session, effectiveTtl);

    logger.info(
      { checkoutId, transactionId, status: session.status },
      'Set payment transaction on checkout'
    );

    return session;
  }

  /**
   * Complete a checkout session
   */
  async complete(
    checkoutId: string,
    orderId: string
  ): Promise<StoredCheckoutSession | null> {
    const session = await this.get(checkoutId);

    if (!session) {
      return null;
    }

    session.orderId = orderId;
    session.status = 'completed';
    session.updatedAt = new Date().toISOString();

    // Store for a short time after completion for retrieval
    await setWithTTL(this.getKey(checkoutId), session, 300); // 5 minutes

    logger.info(
      { checkoutId, orderId },
      'Completed checkout session'
    );

    return session;
  }

  /**
   * Cancel a checkout session
   */
  async cancel(checkoutId: string): Promise<boolean> {
    const session = await this.get(checkoutId);

    if (!session) {
      return false;
    }

    if (session.status === 'completed') {
      logger.warn(
        { checkoutId },
        'Cannot cancel completed checkout'
      );
      return false;
    }

    session.status = 'cancelled';
    session.updatedAt = new Date().toISOString();

    // Store for a short time after cancellation
    await setWithTTL(this.getKey(checkoutId), session, 60);

    logger.info({ checkoutId }, 'Cancelled checkout session');

    return true;
  }

  /**
   * Delete a checkout session
   */
  async delete(checkoutId: string): Promise<boolean> {
    const deleted = await deleteKey(this.getKey(checkoutId));

    if (deleted) {
      logger.info({ checkoutId }, 'Deleted checkout session');
    }

    return deleted;
  }

  /**
   * Check idempotency key for duplicate requests
   * 
   * @returns true if this is a new request, false if duplicate
   */
  async checkIdempotency(
    checkoutId: string,
    idempotencyKey: string,
    ttlSeconds = 86400 // 24 hours
  ): Promise<boolean> {
    const key = REDIS_KEYS.idempotency(`checkout:${checkoutId}:${idempotencyKey}`);
    return setIfNotExists(key, 'used', ttlSeconds);
  }

  /**
   * Check if session exists
   */
  async exists(checkoutId: string): Promise<boolean> {
    const redis = getRedis();
    const result = await redis.exists(this.getKey(checkoutId));
    return result > 0;
  }

  /**
   * Extend session TTL
   */
  async extendTTL(
    checkoutId: string,
    additionalSeconds: number
  ): Promise<boolean> {
    const session = await this.get(checkoutId);

    if (!session || session.status === 'completed' || session.status === 'cancelled') {
      return false;
    }

    const redis = getRedis();
    const key = this.getKey(checkoutId);
    const currentTtl = await redis.ttl(key);

    if (currentTtl < 0) {
      return false;
    }

    const newTtl = currentTtl + additionalSeconds;
    session.expiresAt = new Date(Date.now() + newTtl * 1000).toISOString();
    session.updatedAt = new Date().toISOString();

    await setWithTTL(key, session, newTtl);

    logger.debug(
      { checkoutId, newTtl },
      'Extended checkout session TTL'
    );

    return true;
  }
}

/**
 * Create a session manager instance
 */
export function createSessionManager(
  config?: SessionManagerConfig
): CheckoutSessionManager {
  return new CheckoutSessionManager(config);
}

/**
 * Default session manager instance
 */
let defaultManager: CheckoutSessionManager | null = null;

/**
 * Get default session manager instance
 */
export function getSessionManager(): CheckoutSessionManager {
  if (!defaultManager) {
    defaultManager = createSessionManager();
  }
  return defaultManager;
}
