/**
 * Core Module - Public API
 * 
 * Re-exports all types, schemas, utilities, and constants
 * from the core UCP module.
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Common types
  UCPVersion,
  Money,
  Address,
  Buyer,
  ItemDetails,
  LineItem,
  TotalType,
  Total,
  FulfillmentType,
  FulfillmentOption,
  FulfillmentInfo,
  
  // Checkout types
  CheckoutStatus,
  MessageType,
  CheckoutMessage,
  CheckoutLink,
  PaymentStatus,
  PaymentInfo,
  CheckoutSession,
  CreateCheckoutRequest,
  UpdateCheckoutRequest,
  CompleteCheckoutRequest,
  CheckoutCompletionResult,
  
  // Payment types
  PaymentHandler,
  PaymentHandlerConfig,
  InstrumentType,
  CredentialType,
  PaymentCredential,
  PaymentInstrument,
  PaymentData,
  TokenizeRequest,
  TokenizeResponse,
  DetokenizeRequest,
  DetokenizeResponse,
  
  // Error types
  UCPErrorCode,
  ErrorDetail,
  UCPErrorBody,
  UCPError,
  WixAPIError,
  
  // Identity types
  AuthorizeRequest,
  TokenRequest,
  TokenResponse,
  UserInfoResponse,
  OAuthSession,
  UserConsent,
  IdentityScope,
  
  // Order types
  OrderStatus,
  OrderPaymentStatus,
  OrderFulfillmentStatus,
  Order,
  OrderLineItem,
  ShippingInfo,
  TrackingInfo,
  TrackingEvent,
  ReturnRequest,
  ReturnReason,
  ReturnResponse,
  ListOrdersRequest,
  ListOrdersResponse,
} from './types/index.js';

export { UCPErrorStatusMap, UCPException, IdentityScopes } from './types/index.js';

// ─────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────

export {
  // Common schemas
  MoneySchema,
  AddressSchema,
  EmailSchema,
  PhoneSchema,
  BuyerSchema,
  PartialBuyerSchema,
  ItemDetailsSchema,
  LineItemSchema,
  TotalTypeSchema,
  TotalSchema,
  FulfillmentTypeSchema,
  FulfillmentOptionSchema,
  MetadataSchema,
  UUIDSchema,
  DateTimeSchema,
  
  // Checkout schemas
  CheckoutStatusSchema,
  CreateCheckoutRequestSchema,
  UpdateCheckoutRequestSchema,
  CompleteCheckoutRequestSchema,
  CheckoutIdParamSchema,
  PaymentCredentialSchema,
  
  // Payment schemas
  CardNumberSchema,
  CVVSchema,
  ExpiryMonthSchema,
  ExpiryYearSchema,
  CardPaymentMethodSchema,
  ExternalTokenPaymentMethodSchema,
  PaymentMethodSchema,
  TokenizeRequestSchema,
  DetokenizeRequestSchema,
  InstrumentTypeSchema,
  CredentialTypeSchema,
  PaymentDataSchema,
  
  // Identity schemas
  AuthorizeRequestSchema,
  TokenRequestSchema,
  TokenRequestAuthCodeSchema,
  TokenRequestRefreshSchema,
  RevokeRequestSchema,
  ScopeSchema,
  SupportedScopeSchema,
  
  // Order schemas
  OrderStatusSchema,
  OrderIdParamSchema,
  ListOrdersRequestSchema,
  ReturnReasonSchema,
  ReturnLineItemSchema,
  ReturnRequestSchema,
} from './schemas/index.js';

// Schema input types
export type {
  MoneyInput,
  MoneyOutput,
  AddressInput,
  BuyerInput,
  LineItemInput,
  TotalInput,
  CreateCheckoutInput,
  UpdateCheckoutInput,
  CompleteCheckoutInput,
  TokenizeInput,
  DetokenizeInput,
  PaymentDataInput,
  AuthorizeInput,
  TokenInput,
  RevokeInput,
  ListOrdersInput,
  ReturnInput,
} from './schemas/index.js';

// ─────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────

export {
  // Error utilities
  createUCPError,
  createFieldError,
  createMissingFieldError,
  createNotFoundError,
  createConflictError,
  createRateLimitError,
  createInternalError,
  createUnauthorizedError,
  createForbiddenError,
  mapWixErrorToUCP,
  getStatusForError,
  isRetryableError,
  zodErrorsToDetails,
  createValidationError,
  
  // Crypto utilities
  generateBoundToken,
  verifyTokenBinding,
  isTokenBoundTo,
  generateIdempotencyKey,
  generateOAuthState,
  generateCodeVerifier,
  generateCodeChallenge,
  verifyCodeChallenge,
  generateSecureToken,
  generateAuthorizationCode,
  generateAccessToken,
  generateRefreshToken,
  hashValue,
  verifyHash,
  
  // Validation utilities
  validate,
  validateOrThrow,
  parseBody,
  parseQuery,
  parseParams,
  createBodyValidator,
  createQueryValidator,
  createParamsValidator,
  requireOneOf,
  requireAll,
  stripUndefined,
  isValidUUID,
  isValidDateTime,
  isValidCurrency,
  isValidCountryCode,
} from './utils/index.js';

export type { ValidationResult } from './utils/index.js';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export {
  // UCP Protocol
  UCP_VERSION,
  UCP_SPEC_URL,
  UCP_PROTOCOL,
  
  // Handler
  HANDLER_NAME,
  HANDLER_SPEC_URL,
  HANDLER_VERSION,
  DEFAULT_HANDLER_CONFIG,
  
  // Supported values
  SUPPORTED_CURRENCIES,
  SUPPORTED_CARD_NETWORKS,
  SUPPORTED_INSTRUMENT_TYPES,
  
  // TTL
  TTL,
  
  // HTTP
  HTTP_STATUS,
  
  // Rate limits
  RATE_LIMITS,
  
  // Statuses
  CHECKOUT_STATUSES,
  CHECKOUT_TRANSITIONS,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  
  // Limits
  LIMITS,
  
  // API paths
  API_PATHS,
  
  // Error messages
  ERROR_MESSAGES,
} from './constants.js';

export type {
  SupportedCurrency,
  SupportedCardNetwork,
  SupportedInstrumentType,
} from './constants.js';
