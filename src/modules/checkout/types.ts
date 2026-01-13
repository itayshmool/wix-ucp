/**
 * Checkout Module Types
 * 
 * Module-specific types for the Checkout capability.
 * See: .cursor/rules/modules/checkout.mdc
 */

import type { Address, Buyer, LineItem, Total } from '../../core/types/ucp-common.js';
import type { PaymentHandler } from '../../core/types/payment.js';
import type { CheckoutStatus, CheckoutMessage, CheckoutLink } from '../../core/types/checkout.js';

// ─────────────────────────────────────────────────────────────
// Capability Declaration
// ─────────────────────────────────────────────────────────────

/**
 * Checkout capability info
 */
export const CHECKOUT_CAPABILITY = {
  name: 'dev.ucp.shopping.checkout',
  version: '2026-01-11',
  spec: 'https://ucp.dev/specification/checkout',
} as const;

// ─────────────────────────────────────────────────────────────
// Request/Response Types
// ─────────────────────────────────────────────────────────────

/**
 * Catalog reference for a line item
 */
export interface CatalogReference {
  /** Wix product ID */
  catalogItemId: string;
  /** Wix app ID (stores app: 215238eb-22a5-4c36-9e7b-e7c08025e04e) */
  appId: string;
  /** Product options */
  options?: {
    variantId?: string;
    customTextFields?: Record<string, string>;
  };
}

/**
 * Create checkout request payload
 */
export interface CreateCheckoutPayload {
  /** Currency code (ISO 4217) */
  currency: string;
  /** Buyer information */
  buyer?: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  /** Line items to checkout */
  lineItems: Array<{
    catalogReference: CatalogReference;
    quantity: number;
  }>;
  /** Shipping address */
  shippingAddress?: Address;
  /** Billing address */
  billingAddress?: Address;
  /** Discount code */
  discountCode?: string;
  /** Custom metadata */
  metadata?: Record<string, string>;
}

/**
 * Update checkout request payload
 */
export interface UpdateCheckoutPayload {
  /** Updated buyer info */
  buyer?: Partial<Buyer>;
  /** Shipping address */
  shippingAddress?: Address;
  /** Billing address */
  billingAddress?: Address;
  /** Selected fulfillment option ID */
  selectedFulfillment?: string;
  /** Discount code */
  discountCode?: string;
}

/**
 * Complete checkout request payload
 */
export interface CompleteCheckoutPayload {
  /** Payment data */
  paymentData: {
    /** Payment instrument ID */
    id: string;
    /** Selected payment handler ID */
    handlerId: string;
    /** Payment credential */
    credential: {
      type: 'token';
      token: string;
    };
    /** Billing address */
    billingAddress?: Address;
  };
  /** Idempotency key for duplicate prevention */
  idempotencyKey: string;
}

/**
 * Checkout response (full session data)
 */
export interface CheckoutResponse {
  /** UCP version info */
  ucp: {
    version: string;
    services: {
      'dev.ucp.shopping': {
        version: string;
        spec: string;
      };
    };
  };
  /** Checkout ID */
  id: string;
  /** Current status */
  status: CheckoutStatus;
  /** Currency code */
  currency: string;
  /** Buyer info */
  buyer?: Buyer;
  /** Line items */
  lineItems: LineItem[];
  /** Price totals */
  totals: Total[];
  /** Payment info */
  payment: {
    handlers: PaymentHandler[];
    selectedHandler?: string;
    status?: 'pending' | 'authorized' | 'captured' | 'failed';
    transactionId?: string;
  };
  /** Fulfillment info */
  fulfillment?: FulfillmentInfo;
  /** Validation messages */
  messages: CheckoutMessage[];
  /** Action links */
  links: CheckoutLink[];
  /** Expiration time (ISO 8601) */
  expiresAt: string;
  /** Creation time (ISO 8601) */
  createdAt: string;
  /** Last update time (ISO 8601) */
  updatedAt: string;
}

/**
 * Complete checkout response
 */
export interface CompleteCheckoutResponse {
  /** Checkout ID */
  id: string;
  /** Final status */
  status: 'completed';
  /** Created order ID */
  orderId: string;
  /** Order confirmation number */
  confirmationNumber: string;
  /** Final totals */
  totals: Total[];
  /** Payment result */
  payment: {
    status: 'captured';
    transactionId: string;
  };
}

// ─────────────────────────────────────────────────────────────
// Fulfillment Types
// ─────────────────────────────────────────────────────────────

/**
 * Fulfillment type
 */
export type FulfillmentType = 'shipping' | 'pickup' | 'digital';

/**
 * Fulfillment option
 */
export interface FulfillmentOption {
  /** Option ID */
  id: string;
  /** Type of fulfillment */
  type: FulfillmentType;
  /** Display title */
  title: string;
  /** Description */
  description?: string;
  /** Price in smallest currency unit */
  price: number;
  /** Estimated delivery time */
  estimatedDelivery?: {
    minDays: number;
    maxDays: number;
  };
  /** Carrier name */
  carrier?: string;
}

/**
 * Fulfillment info in checkout
 */
export interface FulfillmentInfo {
  /** Available options */
  options: FulfillmentOption[];
  /** Selected option ID */
  selectedId?: string;
  /** Shipping address */
  address?: Address;
}

// ─────────────────────────────────────────────────────────────
// State Machine Types
// ─────────────────────────────────────────────────────────────

/**
 * Events that can trigger status transitions
 */
export type CheckoutEvent =
  | 'BUYER_INFO_ADDED'
  | 'SHIPPING_SELECTED'
  | 'ALL_INFO_PROVIDED'
  | 'PAYMENT_SUBMITTED'
  | 'PAYMENT_AUTHORIZED'
  | 'ACTION_REQUIRED'
  | 'ACTION_COMPLETED'
  | 'COMPLETE_CALLED'
  | 'CANCEL_CALLED'
  | 'EXPIRED';

/**
 * State transition result
 */
export interface TransitionResult {
  /** Whether the transition was valid */
  valid: boolean;
  /** New status (if valid) */
  newStatus?: CheckoutStatus;
  /** Error message (if invalid) */
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Session Storage Types
// ─────────────────────────────────────────────────────────────

/**
 * Stored checkout session (in Redis)
 */
export interface StoredCheckoutSession {
  /** Session ID */
  id: string;
  /** Current status */
  status: CheckoutStatus;
  /** Currency */
  currency: string;
  /** Buyer info */
  buyer?: Buyer;
  /** Line items */
  lineItems: LineItem[];
  /** Selected fulfillment option ID */
  selectedFulfillmentId?: string;
  /** Shipping address */
  shippingAddress?: Address;
  /** Billing address */
  billingAddress?: Address;
  /** Discount code */
  discountCode?: string;
  /** Custom metadata */
  metadata?: Record<string, string>;
  /** Wix checkout ID (from Wix eCommerce) */
  wixCheckoutId?: string;
  /** Payment transaction ID */
  paymentTransactionId?: string;
  /** Created order ID */
  orderId?: string;
  /** Creation time */
  createdAt: string;
  /** Last update time */
  updatedAt: string;
  /** Expiration time */
  expiresAt: string;
}

// ─────────────────────────────────────────────────────────────
// Totals Types
// ─────────────────────────────────────────────────────────────

/**
 * Total line type
 */
export type TotalType =
  | 'SUBTOTAL'
  | 'SHIPPING'
  | 'TAX'
  | 'DISCOUNT'
  | 'TOTAL';

/**
 * Totals breakdown for calculation
 */
export interface TotalsBreakdown {
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
}

/**
 * Discount info
 */
export interface DiscountInfo {
  /** Discount code */
  code: string;
  /** Discount name */
  name: string;
  /** Discount type */
  type: 'percentage' | 'fixed';
  /** Discount value (percentage or fixed amount) */
  value: number;
}

// ─────────────────────────────────────────────────────────────
// Message Codes
// ─────────────────────────────────────────────────────────────

/**
 * Standard checkout message codes
 */
export const MESSAGE_CODES = {
  // Warnings (missing optional info)
  MISSING_EMAIL: 'MISSING_EMAIL',
  MISSING_SHIPPING: 'MISSING_SHIPPING',
  MISSING_PHONE: 'MISSING_PHONE',
  
  // Errors (blocking issues)
  INVALID_QUANTITY: 'INVALID_QUANTITY',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  ITEM_UNAVAILABLE: 'ITEM_UNAVAILABLE',
  INVALID_DISCOUNT: 'INVALID_DISCOUNT',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  
  // Info
  DISCOUNT_APPLIED: 'DISCOUNT_APPLIED',
  FREE_SHIPPING: 'FREE_SHIPPING',
} as const;

export type MessageCode = typeof MESSAGE_CODES[keyof typeof MESSAGE_CODES];
