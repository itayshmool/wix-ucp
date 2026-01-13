/**
 * Payment Handler Registry
 * 
 * Manages registration and lookup of payment handlers.
 * See: .cursor/rules/modules/discovery.mdc
 */

import { logger } from '../../lib/logger.js';
import type { PaymentHandler } from '../../core/types/payment.js';

/**
 * Filter criteria for finding handlers
 */
export interface HandlerFilterCriteria {
  /** Filter by supported currency */
  supportsCurrency?: string;
  /** Filter by supported payment method */
  supportsMethod?: string;
  /** Filter by supported card network */
  supportsNetwork?: string;
  /** Filter by minimum amount (for BNPL) */
  minAmount?: number;
}

/**
 * Payment Handler Registry
 * 
 * Singleton registry for managing payment handler implementations.
 */
export class PaymentHandlerRegistry {
  private handlers: Map<string, PaymentHandler> = new Map();

  /**
   * Register a payment handler
   */
  register(handler: PaymentHandler): void {
    // Use handler name as the key (e.g., "com.wix.payments")
    const key = handler.name;

    if (this.handlers.has(key)) {
      logger.warn(
        { handler: key },
        'Overwriting existing handler registration'
      );
    }

    this.handlers.set(key, handler);

    logger.info(
      { handler: key, id: handler.id, version: handler.version },
      'Payment handler registered'
    );
  }

  /**
   * Unregister a handler
   */
  unregister(name: string): boolean {
    const deleted = this.handlers.delete(name);

    if (deleted) {
      logger.info({ handler: name }, 'Payment handler unregistered');
    }

    return deleted;
  }

  /**
   * Get handler by name
   */
  get(name: string): PaymentHandler | undefined {
    return this.handlers.get(name);
  }

  /**
   * Get handler by ID
   */
  getById(id: string): PaymentHandler | undefined {
    return this.list().find((h) => h.id === id);
  }

  /**
   * Check if a handler is registered
   */
  has(name: string): boolean {
    return this.handlers.has(name);
  }

  /**
   * List all registered handlers
   */
  list(): PaymentHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Filter handlers by criteria
   */
  filter(criteria: HandlerFilterCriteria): PaymentHandler[] {
    return this.list().filter((handler) => {
      const config = handler.config ?? {};

      // Check currency support
      if (criteria.supportsCurrency) {
        const currencies = config.supportedCurrencies as string[] | undefined;
        if (currencies && !currencies.includes(criteria.supportsCurrency)) {
          return false;
        }
      }

      // Check payment method support
      if (criteria.supportsMethod) {
        const methods = config.supportedPaymentMethods as string[] | undefined;
        if (methods && !methods.includes(criteria.supportsMethod)) {
          return false;
        }
      }

      // Check card network support
      if (criteria.supportsNetwork) {
        const networks = config.supportedCardNetworks as string[] | undefined;
        if (networks && !networks.includes(criteria.supportsNetwork)) {
          return false;
        }
      }

      // Check minimum amount for BNPL handlers
      if (criteria.minAmount !== undefined) {
        const minBnplAmount = config.minBnplAmount as number | undefined;
        if (minBnplAmount !== undefined && criteria.minAmount < minBnplAmount) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get handlers suitable for a checkout context
   */
  getForCheckout(
    checkoutId: string,
    currency: string,
    amount: number
  ): PaymentHandler[] {
    return this.filter({
      supportsCurrency: currency,
      minAmount: amount,
    });
  }

  /**
   * Get handlers by names (for negotiation)
   */
  getByNames(names: string[]): PaymentHandler[] {
    return names
      .map((name) => this.get(name))
      .filter((h): h is PaymentHandler => h !== undefined);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.handlers.clear();
    logger.info('Payment handler registry cleared');
  }

  /**
   * Get count of registered handlers
   */
  get size(): number {
    return this.handlers.size;
  }
}

/**
 * Global handler registry instance
 */
let globalRegistry: PaymentHandlerRegistry | null = null;

/**
 * Get the global payment handler registry
 */
export function getHandlerRegistry(): PaymentHandlerRegistry {
  if (!globalRegistry) {
    globalRegistry = new PaymentHandlerRegistry();
  }
  return globalRegistry;
}

/**
 * Create a new handler registry instance
 */
export function createHandlerRegistry(): PaymentHandlerRegistry {
  return new PaymentHandlerRegistry();
}

/**
 * Register the default Wix Payments handler
 */
export function registerWixPaymentsHandler(
  registry: PaymentHandlerRegistry,
  merchantId: string
): void {
  registry.register({
    id: `wix_handler_${merchantId}`,
    name: 'com.wix.payments',
    version: '2026-01-11',
    spec: 'https://dev.wix.com/ucp/payments/spec',
    config: {
      merchantId,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
      supportedCardNetworks: ['VISA', 'MASTERCARD', 'AMEX', 'DISCOVER'],
      supportedPaymentMethods: ['creditCard', 'debitCard', 'googlePay', 'applePay'],
      supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
      threeDSEnabled: true,
      tokenizationType: 'PAYMENT_GATEWAY',
    },
  });

  logger.info(
    { merchantId },
    'Wix Payments handler registered'
  );
}
