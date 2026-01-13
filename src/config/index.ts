/**
 * Application Configuration
 * 
 * Re-exports configuration from validated environment and core constants.
 */

// Environment configuration
export { env } from './env.js';

// Re-export core constants for convenience
// This allows importing from @config instead of @core
export {
  UCP_VERSION,
  UCP_SPEC_URL,
  UCP_PROTOCOL,
  HANDLER_NAME,
  HANDLER_SPEC_URL,
  HANDLER_VERSION,
  DEFAULT_HANDLER_CONFIG,
  SUPPORTED_CURRENCIES,
  SUPPORTED_CARD_NETWORKS,
  SUPPORTED_INSTRUMENT_TYPES,
  TTL,
  HTTP_STATUS,
  RATE_LIMITS,
  CHECKOUT_STATUSES,
  CHECKOUT_TRANSITIONS,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  LIMITS,
  API_PATHS,
  ERROR_MESSAGES,
} from '../core/constants.js';

export type {
  SupportedCurrency,
  SupportedCardNetwork,
  SupportedInstrumentType,
} from '../core/constants.js';
