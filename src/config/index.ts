/**
 * Application configuration
 * Loaded from validated environment variables
 */

// Re-export env for convenience
export { env } from './env.js';

// UCP Protocol constants
export const UCP_CONSTANTS = {
  VERSION: '2026-01-11',
  SPEC_URL: 'https://ucp.dev/specification/overview',
  HANDLER_NAME: 'com.wix.payments',
  HANDLER_SPEC_URL: 'https://dev.wix.com/ucp/payments/spec',
} as const;

// Supported currencies
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'ILS', 'CAD', 'AUD'] as const;

// Supported card networks
export const SUPPORTED_CARD_NETWORKS = ['VISA', 'MASTERCARD', 'AMEX', 'DISCOVER'] as const;

// TTL configurations (in seconds)
export const TTL = {
  TOKEN: 15 * 60,           // 15 minutes
  CHECKOUT_SESSION: 60 * 60, // 1 hour
  MCP_SESSION: 30 * 60,     // 30 minutes
  PROFILE_CACHE: 5 * 60,    // 5 minutes
} as const;

// Rate limit configurations
export const RATE_LIMITS = {
  DEFAULT: { max: 1000, timeWindow: '1 minute' },
  TOKENIZE: { max: 100, timeWindow: '1 minute' },
  CHECKOUT: { max: 60, timeWindow: '1 minute' },
  AUTH: { max: 20, timeWindow: '1 minute' },
  OAUTH_TOKEN: { max: 5, timeWindow: '1 hour' },
} as const;
