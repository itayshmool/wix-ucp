/**
 * Checkout Types
 * 
 * Type definitions for UCP Checkout capability.
 */

import type {
  UCPVersion,
  Buyer,
  LineItem,
  Total,
  FulfillmentInfo,
  FulfillmentOption,
} from './ucp-common.js';
import type { PaymentHandler, PaymentInstrument } from './payment.js';

/**
 * Checkout session status
 */
export type CheckoutStatus =
  | 'incomplete'          // Missing required information
  | 'ready_for_payment'   // Ready for payment submission
  | 'ready_for_complete'  // Payment received, ready to complete
  | 'requires_action'     // Human intervention needed
  | 'completed'           // Successfully completed
  | 'expired'             // Session expired
  | 'cancelled';          // Cancelled by user/merchant

/**
 * Message severity levels
 */
export type MessageType = 'info' | 'warning' | 'error';

/**
 * Message to display in checkout
 */
export interface CheckoutMessage {
  /** Message severity */
  type: MessageType;
  /** Machine-readable code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Related field path (optional) */
  field?: string;
}

/**
 * Action link in checkout
 */
export interface CheckoutLink {
  /** Relationship type (e.g., "self", "complete", "cancel") */
  rel: string;
  /** URL */
  href: string;
  /** HTTP method (optional, defaults to GET) */
  method?: string;
}

/**
 * Payment status in checkout
 */
export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'failed';

/**
 * Payment info in checkout
 */
export interface PaymentInfo {
  /** Available payment handlers */
  handlers: PaymentHandler[];
  /** Selected handler ID (optional) */
  selectedHandler?: string;
  /** Selected payment instrument (optional) */
  instrument?: PaymentInstrument;
  /** Payment status (optional) */
  status?: PaymentStatus;
}

/**
 * Checkout session object
 */
export interface CheckoutSession {
  /** UCP version info */
  ucp: UCPVersion;
  /** Unique checkout session ID */
  id: string;
  /** Current checkout status */
  status: CheckoutStatus;
  /** Currency for this checkout (ISO 4217) */
  currency: string;
  /** Buyer information (optional) */
  buyer?: Buyer;
  /** Line items in the checkout */
  lineItems: LineItem[];
  /** Price breakdown totals */
  totals: Total[];
  /** Payment information (optional) */
  payment?: PaymentInfo;
  /** Fulfillment information (optional) */
  fulfillment?: FulfillmentInfo;
  /** Available fulfillment options (optional) */
  fulfillmentOptions?: FulfillmentOption[];
  /** Messages to display (optional) */
  messages?: CheckoutMessage[];
  /** Action links (optional) */
  links?: CheckoutLink[];
  /** Session expiration time (ISO 8601) */
  expiresAt?: string;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
  /** Custom metadata (optional) */
  metadata?: Record<string, string>;
}

/**
 * Create checkout request
 */
export interface CreateCheckoutRequest {
  /** Currency code (ISO 4217) */
  currency: string;
  /** Buyer information (optional) */
  buyer?: Buyer;
  /** Line items to checkout */
  lineItems: Array<{
    itemId: string;
    quantity: number;
  }>;
  /** Custom metadata (optional) */
  metadata?: Record<string, string>;
}

/**
 * Update checkout request
 */
export interface UpdateCheckoutRequest {
  /** Updated buyer information (optional) */
  buyer?: Partial<Buyer>;
  /** Selected fulfillment option ID (optional) */
  fulfillmentOptionId?: string;
  /** Shipping address (optional) */
  shippingAddress?: Buyer['address'];
  /** Custom metadata (optional) */
  metadata?: Record<string, string>;
}

/**
 * Complete checkout request
 */
export interface CompleteCheckoutRequest {
  /** Payment data */
  payment: {
    /** Payment handler ID */
    handlerId: string;
    /** Payment instrument ID */
    instrumentId: string;
    /** Payment credential */
    credential: {
      type: 'token';
      token: string;
    };
    /** Billing address (optional) */
    billingAddress?: Buyer['address'];
  };
}

/**
 * Checkout completion result
 */
export interface CheckoutCompletionResult {
  /** Resulting order ID */
  orderId: string;
  /** Order confirmation number */
  confirmationNumber: string;
  /** Final checkout status */
  status: 'completed';
}
