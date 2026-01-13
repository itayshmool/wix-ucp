/**
 * Order Types
 * 
 * Type definitions for UCP Order Management capability.
 */

import type { Address, Buyer, LineItem, Total, FulfillmentType } from './ucp-common.js';

/**
 * Order status
 */
export type OrderStatus =
  | 'PENDING'           // Order created, awaiting payment
  | 'APPROVED'          // Payment approved
  | 'PROCESSING'        // Being prepared
  | 'SHIPPED'           // Shipped/dispatched
  | 'DELIVERED'         // Delivered to customer
  | 'COMPLETED'         // Order complete
  | 'CANCELLED'         // Cancelled
  | 'REFUNDED';         // Fully refunded

/**
 * Order payment status
 */
export type OrderPaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'FAILED';

/**
 * Order fulfillment status
 */
export type OrderFulfillmentStatus =
  | 'NOT_FULFILLED'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED';

/**
 * Order object
 */
export interface Order {
  /** Unique order ID */
  id: string;
  /** Order number (human-readable) */
  orderNumber: string;
  /** Current order status */
  status: OrderStatus;
  /** Payment status */
  paymentStatus: OrderPaymentStatus;
  /** Fulfillment status */
  fulfillmentStatus: OrderFulfillmentStatus;
  /** Currency (ISO 4217) */
  currency: string;
  /** Buyer information */
  buyer: Buyer;
  /** Line items */
  lineItems: OrderLineItem[];
  /** Price totals */
  totals: Total[];
  /** Shipping information (optional) */
  shippingInfo?: ShippingInfo;
  /** Billing address (optional) */
  billingAddress?: Address;
  /** Tracking information (optional) */
  tracking?: TrackingInfo[];
  /** Order creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

/**
 * Line item in an order (with fulfillment status)
 */
export interface OrderLineItem extends LineItem {
  /** Quantity fulfilled */
  quantityFulfilled: number;
  /** Quantity refunded */
  quantityRefunded: number;
}

/**
 * Shipping information
 */
export interface ShippingInfo {
  /** Fulfillment type */
  type: FulfillmentType;
  /** Shipping address */
  address: Address;
  /** Selected shipping method */
  method?: {
    id: string;
    title: string;
    price: number;
  };
  /** Estimated delivery date (ISO 8601) */
  estimatedDelivery?: string;
}

/**
 * Tracking information
 */
export interface TrackingInfo {
  /** Tracking number */
  trackingNumber: string;
  /** Carrier/shipping provider */
  carrier: string;
  /** Tracking URL */
  trackingUrl?: string;
  /** Shipped timestamp (ISO 8601) */
  shippedAt: string;
  /** Tracking events */
  events?: TrackingEvent[];
}

/**
 * Tracking event
 */
export interface TrackingEvent {
  /** Event timestamp (ISO 8601) */
  timestamp: string;
  /** Event description */
  description: string;
  /** Location (optional) */
  location?: string;
  /** Event status code */
  status: string;
}

/**
 * Return request
 */
export interface ReturnRequest {
  /** Line items to return */
  lineItems: Array<{
    lineItemId: string;
    quantity: number;
    reason: ReturnReason;
    note?: string;
  }>;
}

/**
 * Return reasons
 */
export type ReturnReason =
  | 'CHANGED_MIND'
  | 'DAMAGED'
  | 'DEFECTIVE'
  | 'WRONG_ITEM'
  | 'NOT_AS_DESCRIBED'
  | 'OTHER';

/**
 * Return response
 */
export interface ReturnResponse {
  /** Return ID */
  returnId: string;
  /** Return status */
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  /** Return instructions */
  instructions?: string;
  /** Return label URL (optional) */
  labelUrl?: string;
  /** Refund amount (if approved) */
  refundAmount?: number;
}

/**
 * Order list request
 */
export interface ListOrdersRequest {
  /** Filter by status (optional) */
  status?: OrderStatus;
  /** Filter by date range start (ISO 8601) */
  from?: string;
  /** Filter by date range end (ISO 8601) */
  to?: string;
  /** Maximum results to return */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
}

/**
 * Order list response
 */
export interface ListOrdersResponse {
  /** Orders */
  orders: Order[];
  /** Next page cursor (optional) */
  nextCursor?: string;
  /** Total count (optional) */
  totalCount?: number;
}
