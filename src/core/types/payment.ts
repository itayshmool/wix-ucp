/**
 * Payment Types
 * 
 * Type definitions for UCP Payment Handler capability.
 */

import type { Address } from './ucp-common.js';

/**
 * Payment handler declaration
 */
export interface PaymentHandler {
  /** Unique handler instance ID */
  id: string;
  /** Handler type name (e.g., "com.wix.payments") */
  name: string;
  /** Handler version */
  version: string;
  /** URL to handler specification */
  spec: string;
  /** URL to configuration JSON schema (optional) */
  configSchema?: string;
  /** URLs to supported instrument schemas (optional) */
  instrumentSchemas?: string[];
  /** Handler-specific configuration */
  config: PaymentHandlerConfig;
}

/**
 * Payment handler configuration
 */
export interface PaymentHandlerConfig {
  /** Supported card networks */
  supportedNetworks?: string[];
  /** Supported currencies */
  supportedCurrencies?: string[];
  /** Whether handler supports tokenization */
  supportsTokenization?: boolean;
  /** Whether handler supports recurring payments */
  supportsRecurring?: boolean;
  /** Additional handler-specific settings */
  [key: string]: unknown;
}

/**
 * Payment instrument types
 */
export type InstrumentType = 'card' | 'wallet' | 'bank' | 'bnpl';

/**
 * Payment credential types
 */
export type CredentialType = 'token' | 'encrypted' | 'mandate';

/**
 * Payment credential (opaque to UCP)
 */
export interface PaymentCredential {
  /** Credential type */
  type: CredentialType;
  /** Token value (for token type) */
  token?: string;
  /** Encrypted payload (for encrypted type) */
  encryptedPayload?: string;
  /** Mandate ID (for mandate type) */
  mandateId?: string;
}

/**
 * Payment instrument (user's payment method)
 */
export interface PaymentInstrument {
  /** Unique instrument ID */
  id: string;
  /** Instrument type */
  type: InstrumentType;
  /** Card network/brand (e.g., "VISA", "MASTERCARD") */
  brand?: string;
  /** Last 4 digits (for cards) */
  lastDigits?: string;
  /** Expiry month (1-12) */
  expiryMonth?: string;
  /** Expiry year (4 digits) */
  expiryYear?: string;
  /** Payment credential */
  credential: PaymentCredential;
}

/**
 * Payment data for checkout completion
 */
export interface PaymentData {
  /** Instrument ID */
  id: string;
  /** Handler ID that issued the instrument */
  handlerId: string;
  /** Payment credential */
  credential: PaymentCredential;
  /** Billing address (optional) */
  billingAddress?: Address;
}

/**
 * Tokenize request (sent to payment handler)
 */
export interface TokenizeRequest {
  /** Checkout session ID (for binding) */
  checkoutId: string;
  /** Raw card data or external token */
  paymentMethod: {
    type: 'card';
    /** Card number (PAN) */
    number: string;
    /** Expiry month (1-12) */
    expiryMonth: string;
    /** Expiry year (2 or 4 digits) */
    expiryYear: string;
    /** CVV/CVC */
    cvv: string;
    /** Cardholder name (optional) */
    cardholderName?: string;
  } | {
    type: 'external_token';
    /** Token from external provider (e.g., Stripe, Google Pay) */
    token: string;
    /** Provider name */
    provider: string;
  };
}

/**
 * Tokenize response
 */
export interface TokenizeResponse {
  /** Generated payment instrument */
  instrument: PaymentInstrument;
  /** Token expiration time (ISO 8601) */
  expiresAt: string;
}

/**
 * Detokenize request
 */
export interface DetokenizeRequest {
  /** Checkout session ID */
  checkoutId: string;
  /** Token to detokenize */
  token: string;
}

/**
 * Detokenize response (internal use only)
 */
export interface DetokenizeResponse {
  /** Original Wix payment token */
  wixToken: string;
  /** Token metadata */
  metadata: {
    checkoutId: string;
    instrumentId: string;
    createdAt: string;
  };
}
