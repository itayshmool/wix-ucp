/**
 * Wix API Type Definitions
 * 
 * Type definitions for Wix Platform API responses.
 */

// ─────────────────────────────────────────────────────────────
// Common Types
// ─────────────────────────────────────────────────────────────

/**
 * Wix API error response
 */
export interface WixApiError {
  message: string;
  details?: {
    applicationError?: {
      code: string;
      description: string;
    };
  };
}

/**
 * Wix paging metadata
 */
export interface WixPaging {
  limit: number;
  offset: number;
  total?: number;
}

/**
 * Wix cursors for pagination
 */
export interface WixCursors {
  next?: string;
  prev?: string;
}

// ─────────────────────────────────────────────────────────────
// Wix Payments Types
// ─────────────────────────────────────────────────────────────

/**
 * Wix card token request
 */
export interface WixCreateCardTokenRequest {
  /** Card number (PAN) */
  cardNumber: string;
  /** Expiry month (01-12) */
  expiryMonth: string;
  /** Expiry year (4 digits) */
  expiryYear: string;
  /** CVV/CVC */
  cvv: string;
  /** Cardholder name */
  cardholderName?: string;
  /** Billing address */
  billingAddress?: WixBillingAddress;
}

/**
 * Wix billing address
 */
export interface WixBillingAddress {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  subdivision?: string;
  country?: string;
  postalCode?: string;
}

/**
 * Wix card token response
 */
export interface WixCardTokenResponse {
  /** Tokenized card token */
  cardToken: string;
  /** Card brand */
  cardBrand: string;
  /** Last 4 digits */
  lastFourDigits: string;
  /** Expiry month */
  expiryMonth: string;
  /** Expiry year */
  expiryYear: string;
  /** Token expiration time (ISO 8601) */
  expiresAt: string;
}

/**
 * Wix transaction request
 */
export interface WixCreateTransactionRequest {
  /** Amount in smallest currency unit */
  amount: number;
  /** Currency code (ISO 4217) */
  currency: string;
  /** Card token */
  cardToken: string;
  /** Order reference */
  orderReference?: string;
  /** Description */
  description?: string;
  /** 3D Secure settings */
  threeDSecure?: {
    enabled: boolean;
    returnUrl?: string;
  };
  /** Capture immediately or authorize only */
  captureNow: boolean;
}

/**
 * Wix transaction response
 */
export interface WixTransactionResponse {
  /** Transaction ID */
  id: string;
  /** Transaction status */
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'REQUIRES_3DS' | 'CAPTURED' | 'VOIDED' | 'REFUNDED';
  /** Amount */
  amount: number;
  /** Currency */
  currency: string;
  /** Authorization code */
  authorizationCode?: string;
  /** Decline reason (if declined) */
  declineReason?: string;
  /** 3DS redirect URL (if REQUIRES_3DS) */
  threeDSecureRedirectUrl?: string;
  /** Created timestamp */
  createdAt: string;
}

/**
 * Wix refund request
 */
export interface WixRefundRequest {
  /** Amount to refund (partial refund if less than original) */
  amount: number;
  /** Reason for refund */
  reason?: string;
}

/**
 * Wix refund response
 */
export interface WixRefundResponse {
  /** Refund ID */
  id: string;
  /** Transaction ID */
  transactionId: string;
  /** Refund status */
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  /** Amount refunded */
  amount: number;
  /** Currency */
  currency: string;
  /** Created timestamp */
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// Wix eCommerce Types
// ─────────────────────────────────────────────────────────────

/**
 * Wix checkout
 */
export interface WixCheckout {
  /** Checkout ID */
  id: string;
  /** Cart ID */
  cartId: string;
  /** Buyer info */
  buyerInfo?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  /** Line items */
  lineItems: WixLineItem[];
  /** Shipping info */
  shippingInfo?: WixShippingInfo;
  /** Billing info */
  billingInfo?: WixBillingInfo;
  /** Price summary */
  priceSummary: WixPriceSummary;
  /** Currency */
  currency: string;
  /** Created date */
  createdDate: string;
  /** Updated date */
  updatedDate: string;
}

/**
 * Wix line item
 */
export interface WixLineItem {
  id: string;
  productName: string;
  quantity: number;
  price: string;
  totalPrice: string;
  image?: {
    url: string;
    altText?: string;
  };
  descriptionLines?: string[];
  sku?: string;
  catalogReference?: {
    catalogItemId: string;
    appId: string;
  };
}

/**
 * Wix shipping info
 */
export interface WixShippingInfo {
  carrierServiceOption?: {
    carrierId: string;
    serviceName: string;
    cost: string;
  };
  shippingDestination?: {
    address: WixBillingAddress;
    contactDetails?: {
      firstName?: string;
      lastName?: string;
      phone?: string;
    };
  };
}

/**
 * Wix billing info
 */
export interface WixBillingInfo {
  address?: WixBillingAddress;
  contactDetails?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
}

/**
 * Wix price summary
 */
export interface WixPriceSummary {
  subtotal: string;
  shipping?: string;
  tax?: string;
  discount?: string;
  total: string;
}

/**
 * Wix order
 */
export interface WixOrder {
  /** Order ID */
  id: string;
  /** Order number */
  number: string;
  /** Order status */
  status: 'INITIALIZED' | 'APPROVED' | 'CANCELED' | 'FULFILLED';
  /** Payment status */
  paymentStatus: 'NOT_PAID' | 'PAID' | 'PARTIALLY_REFUNDED' | 'FULLY_REFUNDED';
  /** Fulfillment status */
  fulfillmentStatus: 'NOT_FULFILLED' | 'FULFILLED' | 'PARTIALLY_FULFILLED';
  /** Buyer info */
  buyerInfo: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    memberId?: string;
  };
  /** Line items */
  lineItems: WixLineItem[];
  /** Totals */
  totals: WixPriceSummary;
  /** Currency */
  currency: string;
  /** Created date */
  createdDate: string;
  /** Updated date */
  updatedDate: string;
  /** Fulfillments */
  fulfillments?: WixFulfillment[];
}

/**
 * Wix fulfillment
 */
export interface WixFulfillment {
  id: string;
  lineItems: Array<{
    lineItemId: string;
    quantity: number;
  }>;
  trackingInfo?: {
    trackingNumber: string;
    shippingProvider: string;
    trackingLink?: string;
  };
  createdDate: string;
}
