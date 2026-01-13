/**
 * Order Management Types
 * 
 * Type definitions for UCP Order Management capability.
 * See: .cursor/rules/modules/orders.mdc
 */

import type { Address, Buyer, Money, Total } from '../../core/types/ucp-common.js';

// ─────────────────────────────────────────────────────────────
// Capability Declaration
// ─────────────────────────────────────────────────────────────

export const ORDERS_CAPABILITY = {
  name: 'dev.ucp.shopping.orders',
  version: '2026-01-11',
  spec: 'https://ucp.dev/specification/orders',
} as const;

// ─────────────────────────────────────────────────────────────
// Order Status Types
// ─────────────────────────────────────────────────────────────

/**
 * Order status values
 */
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

/**
 * Payment status values
 */
export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'partially_refunded'
  | 'refunded'
  | 'failed';

/**
 * Shipment status values
 */
export type ShipmentStatus =
  | 'label_created'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception';

/**
 * Return status values
 */
export type ReturnStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'in_transit'
  | 'received'
  | 'refunded';

/**
 * Return reason values
 */
export type ReturnReason =
  | 'defective'
  | 'not_as_described'
  | 'wrong_item'
  | 'no_longer_needed'
  | 'other';

// ─────────────────────────────────────────────────────────────
// Order Types
// ─────────────────────────────────────────────────────────────

/**
 * Order line item
 */
export interface OrderLineItem {
  /** Line item ID */
  id: string;
  /** Product ID */
  productId: string;
  /** Product name */
  name: string;
  /** Product SKU */
  sku?: string;
  /** Quantity */
  quantity: number;
  /** Unit price */
  unitPrice: Money;
  /** Total price for this line */
  totalPrice: Money;
  /** Product image URL */
  imageUrl?: string;
  /** Product URL */
  productUrl?: string;
  /** Fulfillment status */
  fulfillmentStatus?: 'unfulfilled' | 'fulfilled' | 'partially_fulfilled';
}

/**
 * Order payment info
 */
export interface OrderPayment {
  /** Payment status */
  status: PaymentStatus;
  /** Payment method (e.g., 'credit_card', 'paypal') */
  method: string;
  /** Transaction ID */
  transactionId?: string;
  /** Last 4 digits of card */
  cardLastDigits?: string;
  /** Card brand */
  cardBrand?: string;
}

/**
 * Order fulfillment info
 */
export interface OrderFulfillment {
  /** Overall fulfillment status */
  status: 'unfulfilled' | 'fulfilled' | 'partially_fulfilled';
  /** Shipping address */
  shippingAddress?: Address;
  /** Shipping method */
  shippingMethod?: string;
  /** Estimated delivery date */
  estimatedDelivery?: string;
}

/**
 * HATEOAS link for orders
 */
export interface OrderLink {
  /** Relation type */
  rel: string;
  /** URL */
  href: string;
  /** HTTP method */
  method: string;
}

/**
 * Full order response
 */
export interface OrderResponse {
  /** UCP version */
  ucp: { version: string };
  /** Order ID */
  id: string;
  /** Related checkout ID */
  checkoutId?: string;
  /** Confirmation/order number */
  confirmationNumber: string;
  /** Order status */
  status: OrderStatus;
  /** Buyer info */
  buyer: Buyer;
  /** Line items */
  lineItems: OrderLineItem[];
  /** Order totals */
  totals: Total[];
  /** Payment info */
  payment: OrderPayment;
  /** Fulfillment info */
  fulfillment: OrderFulfillment;
  /** Currency */
  currency: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** HATEOAS links */
  links: OrderLink[];
}

/**
 * Order summary (for list)
 */
export interface OrderSummary {
  /** Order ID */
  id: string;
  /** Confirmation number */
  confirmationNumber: string;
  /** Order status */
  status: OrderStatus;
  /** Number of items */
  itemCount: number;
  /** Total amount */
  total: Money;
  /** Creation timestamp */
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// List Orders Types
// ─────────────────────────────────────────────────────────────

/**
 * List orders request params
 */
export interface ListOrdersParams {
  /** Filter by status */
  status?: OrderStatus;
  /** Max results (default 20, max 100) */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
  /** Filter by created after */
  createdAfter?: string;
  /** Filter by created before */
  createdBefore?: string;
}

/**
 * List orders response
 */
export interface ListOrdersResponse {
  /** Order summaries */
  orders: OrderSummary[];
  /** Pagination info */
  pagination: {
    cursor?: string;
    hasMore: boolean;
  };
}

// ─────────────────────────────────────────────────────────────
// Tracking Types
// ─────────────────────────────────────────────────────────────

/**
 * Tracking event
 */
export interface TrackingEvent {
  /** Event timestamp */
  timestamp: string;
  /** Shipment status */
  status: ShipmentStatus;
  /** Event location */
  location?: string;
  /** Event description */
  description: string;
}

/**
 * Shipment info
 */
export interface Shipment {
  /** Shipment ID */
  id: string;
  /** Carrier name */
  carrier: string;
  /** Tracking number */
  trackingNumber: string;
  /** Tracking URL */
  trackingUrl?: string;
  /** Shipment status */
  status: ShipmentStatus;
  /** Estimated delivery */
  estimatedDelivery?: string;
  /** Tracking events */
  events: TrackingEvent[];
  /** Line item IDs in this shipment */
  items: string[];
}

/**
 * Tracking response
 */
export interface TrackingResponse {
  /** Order ID */
  orderId: string;
  /** Shipments */
  shipments: Shipment[];
}

// ─────────────────────────────────────────────────────────────
// Return Types
// ─────────────────────────────────────────────────────────────

/**
 * Return line item request
 */
export interface ReturnLineItemRequest {
  /** Line item ID */
  id: string;
  /** Quantity to return */
  quantity: number;
  /** Return reason */
  reason: ReturnReason;
  /** Additional notes */
  notes?: string;
}

/**
 * Return request
 */
export interface ReturnRequest {
  /** Items to return */
  lineItems: ReturnLineItemRequest[];
}

/**
 * Return line item response
 */
export interface ReturnLineItem {
  /** Line item ID */
  id: string;
  /** Product name */
  name: string;
  /** Quantity being returned */
  quantity: number;
  /** Return reason */
  reason: ReturnReason;
  /** Refund amount for this item */
  refundAmount: Money;
}

/**
 * Return label
 */
export interface ReturnLabel {
  /** Carrier */
  carrier: string;
  /** Tracking number */
  trackingNumber: string;
  /** Label download URL */
  labelUrl: string;
}

/**
 * Return response
 */
export interface ReturnResponse {
  /** Return ID */
  returnId: string;
  /** Order ID */
  orderId: string;
  /** Return status */
  status: ReturnStatus;
  /** Items being returned */
  lineItems: ReturnLineItem[];
  /** Total refund amount */
  refundAmount?: Money;
  /** Return label (if provided) */
  returnLabel?: ReturnLabel;
  /** Return instructions */
  instructions: string;
  /** Created timestamp */
  createdAt: string;
}

/**
 * Return policy
 */
export interface ReturnPolicy {
  /** Days from delivery */
  windowDays: number;
  /** Restocking fee percentage */
  restockingFee?: number;
  /** Categories excluded from returns */
  excludedCategories?: string[];
  /** Whether a return label is required */
  requiresLabel: boolean;
}

// ─────────────────────────────────────────────────────────────
// Webhook Types
// ─────────────────────────────────────────────────────────────

/**
 * Order webhook event types
 */
export type OrderEventType =
  | 'order.created'
  | 'order.updated'
  | 'order.shipped'
  | 'order.delivered'
  | 'order.cancelled'
  | 'return.requested'
  | 'return.approved'
  | 'return.received'
  | 'refund.processed';

/**
 * Webhook payload
 */
export interface OrderWebhook {
  /** Webhook event ID */
  id: string;
  /** Event type */
  type: OrderEventType;
  /** Event timestamp */
  timestamp: string;
  /** Event data */
  data: {
    orderId: string;
    status: OrderStatus;
    previousStatus?: OrderStatus;
    [key: string]: unknown;
  };
  /** HMAC signature */
  signature: string;
}

/**
 * Webhook subscription
 */
export interface WebhookSubscription {
  /** Subscription ID */
  id: string;
  /** Webhook URL */
  url: string;
  /** Events to subscribe to */
  events: OrderEventType[];
  /** Whether active */
  active: boolean;
  /** Created timestamp */
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/**
 * Order cache TTL by status (seconds)
 */
export const ORDER_CACHE_TTL: Record<OrderStatus, number> = {
  pending: 60,        // 1 minute (status may change)
  confirmed: 120,     // 2 minutes
  processing: 300,    // 5 minutes
  shipped: 300,       // 5 minutes
  delivered: 3600,    // 1 hour
  cancelled: 86400,   // 24 hours (won't change)
  returned: 86400,    // 24 hours
};

/**
 * Default return policy
 */
export const DEFAULT_RETURN_POLICY: ReturnPolicy = {
  windowDays: 30,
  restockingFee: 0,
  requiresLabel: true,
};
