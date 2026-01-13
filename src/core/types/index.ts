/**
 * Core Types - Public Exports
 * 
 * Re-exports all UCP type definitions.
 */

// Common types
export type {
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
} from './ucp-common.js';

// Checkout types
export type {
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
} from './checkout.js';

// Payment types
export type {
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
} from './payment.js';

// Error types
export type {
  UCPErrorCode,
  ErrorDetail,
  UCPErrorBody,
  UCPError,
  WixAPIError,
} from './errors.js';

export { UCPErrorStatusMap, UCPException } from './errors.js';

// Identity types
export type {
  AuthorizeRequest,
  TokenRequest,
  TokenResponse,
  UserInfoResponse,
  OAuthSession,
  UserConsent,
  IdentityScope,
} from './identity.js';

export { IdentityScopes } from './identity.js';

// Order types
export type {
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
} from './order.js';
