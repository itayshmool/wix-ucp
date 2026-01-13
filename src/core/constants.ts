/**
 * Core Constants
 * 
 * UCP protocol constants, configuration values, and defaults.
 */

// ─────────────────────────────────────────────────────────────
// UCP Protocol
// ─────────────────────────────────────────────────────────────

/** Current UCP protocol version */
export const UCP_VERSION = '2026-01-11';

/** UCP specification URL */
export const UCP_SPEC_URL = 'https://ucp.dev/specification/overview';

/** UCP protocol version object */
export const UCP_PROTOCOL = {
  version: UCP_VERSION,
  spec: UCP_SPEC_URL,
} as const;

// ─────────────────────────────────────────────────────────────
// Payment Handler
// ─────────────────────────────────────────────────────────────

/** Wix Payments handler name */
export const HANDLER_NAME = 'com.wix.payments';

/** Handler specification URL */
export const HANDLER_SPEC_URL = 'https://dev.wix.com/ucp/payments/spec';

/** Handler version */
export const HANDLER_VERSION = '1.0.0';

/** Default handler configuration */
export const DEFAULT_HANDLER_CONFIG = {
  supportsTokenization: true,
  supportsRecurring: false,
} as const;

// ─────────────────────────────────────────────────────────────
// Supported Values
// ─────────────────────────────────────────────────────────────

/** Supported currencies (ISO 4217) */
export const SUPPORTED_CURRENCIES = [
  'USD', // US Dollar
  'EUR', // Euro
  'GBP', // British Pound
  'ILS', // Israeli Shekel
  'CAD', // Canadian Dollar
  'AUD', // Australian Dollar
  'JPY', // Japanese Yen
  'CHF', // Swiss Franc
  'BRL', // Brazilian Real
  'MXN', // Mexican Peso
] as const;

export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

/** Supported card networks */
export const SUPPORTED_CARD_NETWORKS = [
  'VISA',
  'MASTERCARD',
  'AMEX',
  'DISCOVER',
  'DINERS',
  'JCB',
] as const;

export type SupportedCardNetwork = typeof SUPPORTED_CARD_NETWORKS[number];

/** Supported payment instrument types */
export const SUPPORTED_INSTRUMENT_TYPES = [
  'card',
  'wallet',
  'bank',
  'bnpl',
] as const;

export type SupportedInstrumentType = typeof SUPPORTED_INSTRUMENT_TYPES[number];

// ─────────────────────────────────────────────────────────────
// TTL (Time-To-Live) Values
// ─────────────────────────────────────────────────────────────

/** TTL values in seconds */
export const TTL = {
  /** Payment token TTL (30 minutes) */
  TOKEN: 30 * 60,
  
  /** Checkout session TTL (24 hours) */
  CHECKOUT: 24 * 60 * 60,
  
  /** MCP session TTL (1 hour) */
  MCP_SESSION: 60 * 60,
  
  /** Business profile cache TTL (5 minutes) */
  PROFILE_CACHE: 5 * 60,
  
  /** Idempotency key TTL (24 hours) */
  IDEMPOTENCY: 24 * 60 * 60,
  
  /** OAuth authorization code TTL (10 minutes) */
  AUTH_CODE: 10 * 60,
  
  /** OAuth access token TTL (1 hour) */
  ACCESS_TOKEN: 60 * 60,
  
  /** OAuth refresh token TTL (30 days) */
  REFRESH_TOKEN: 30 * 24 * 60 * 60,
  
  /** Rate limit window (1 minute) */
  RATE_LIMIT_WINDOW: 60,
} as const;

// ─────────────────────────────────────────────────────────────
// HTTP Status Codes
// ─────────────────────────────────────────────────────────────

/** HTTP status codes */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// ─────────────────────────────────────────────────────────────
// Rate Limits
// ─────────────────────────────────────────────────────────────

/** Rate limit configurations */
export const RATE_LIMITS = {
  /** Default rate limit */
  DEFAULT: {
    max: 100,
    timeWindow: '1 minute',
  },
  
  /** Tokenization endpoint rate limit */
  TOKENIZE: {
    max: 20,
    timeWindow: '1 minute',
  },
  
  /** Checkout operations rate limit */
  CHECKOUT: {
    max: 50,
    timeWindow: '1 minute',
  },
  
  /** OAuth endpoints rate limit */
  OAUTH: {
    max: 30,
    timeWindow: '1 minute',
  },
  
  /** Discovery endpoint rate limit */
  DISCOVERY: {
    max: 200,
    timeWindow: '1 minute',
  },
} as const;

// ─────────────────────────────────────────────────────────────
// Checkout
// ─────────────────────────────────────────────────────────────

/** Valid checkout statuses */
export const CHECKOUT_STATUSES = [
  'incomplete',
  'ready_for_payment',
  'ready_for_complete',
  'requires_action',
  'completed',
  'expired',
  'cancelled',
] as const;

/** Checkout status transitions */
export const CHECKOUT_TRANSITIONS: Record<string, string[]> = {
  incomplete: ['ready_for_payment', 'cancelled', 'expired'],
  ready_for_payment: ['ready_for_complete', 'incomplete', 'cancelled', 'expired'],
  ready_for_complete: ['completed', 'requires_action', 'cancelled'],
  requires_action: ['ready_for_complete', 'cancelled'],
  completed: [], // Terminal state
  expired: [], // Terminal state
  cancelled: [], // Terminal state
};

// ─────────────────────────────────────────────────────────────
// Order
// ─────────────────────────────────────────────────────────────

/** Valid order statuses */
export const ORDER_STATUSES = [
  'PENDING',
  'APPROVED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
] as const;

/** Order status transitions */
export const ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['APPROVED', 'CANCELLED'],
  APPROVED: ['PROCESSING', 'CANCELLED', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'CANCELLED', 'REFUNDED'],
  SHIPPED: ['DELIVERED', 'REFUNDED'],
  DELIVERED: ['COMPLETED', 'REFUNDED'],
  COMPLETED: ['REFUNDED'],
  CANCELLED: [], // Terminal state
  REFUNDED: [], // Terminal state
};

// ─────────────────────────────────────────────────────────────
// Validation Limits
// ─────────────────────────────────────────────────────────────

/** Validation limits */
export const LIMITS = {
  /** Maximum line items per checkout */
  MAX_LINE_ITEMS: 100,
  
  /** Maximum quantity per line item */
  MAX_QUANTITY: 9999,
  
  /** Maximum metadata entries */
  MAX_METADATA_ENTRIES: 50,
  
  /** Maximum metadata key length */
  MAX_METADATA_KEY_LENGTH: 100,
  
  /** Maximum metadata value length */
  MAX_METADATA_VALUE_LENGTH: 500,
  
  /** Maximum order history results */
  MAX_ORDER_RESULTS: 100,
  
  /** Default order history page size */
  DEFAULT_PAGE_SIZE: 20,
} as const;

// ─────────────────────────────────────────────────────────────
// API Paths
// ─────────────────────────────────────────────────────────────

/** API path prefixes */
export const API_PATHS = {
  /** UCP API prefix */
  UCP: '/ucp/v1',
  
  /** Discovery endpoint */
  DISCOVERY: '/.well-known/ucp',
  
  /** Health check endpoint */
  HEALTH: '/health',
  
  /** MCP endpoint */
  MCP: '/mcp',
} as const;

// ─────────────────────────────────────────────────────────────
// Error Messages
// ─────────────────────────────────────────────────────────────

/** Standard error messages */
export const ERROR_MESSAGES = {
  CHECKOUT_NOT_FOUND: 'Checkout session not found',
  CHECKOUT_EXPIRED: 'Checkout session has expired',
  CHECKOUT_COMPLETED: 'Checkout session is already completed',
  CHECKOUT_CANCELLED: 'Checkout session was cancelled',
  
  TOKEN_NOT_FOUND: 'Payment token not found',
  TOKEN_EXPIRED: 'Payment token has expired',
  TOKEN_ALREADY_USED: 'Payment token has already been used',
  TOKEN_INVALID_BINDING: 'Payment token is not bound to this checkout',
  
  ORDER_NOT_FOUND: 'Order not found',
  ORDER_INVALID_STATUS: 'Invalid order status transition',
  
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Permission denied',
  RATE_LIMITED: 'Too many requests, please try again later',
  INTERNAL_ERROR: 'An internal error occurred',
  
  INVALID_CURRENCY: 'Currency not supported',
  INVALID_CARD_NETWORK: 'Card network not supported',
} as const;
