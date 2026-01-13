/**
 * Order State Machine
 * 
 * Defines valid order status transitions and state logic.
 * See: .cursor/rules/modules/orders.mdc
 */

import type { OrderStatus, PaymentStatus, ShipmentStatus, ReturnStatus } from './types.js';

// ─────────────────────────────────────────────────────────────
// Order Status Transitions
// ─────────────────────────────────────────────────────────────

/**
 * Valid order status transitions
 * 
 * State flow:
 * pending -> confirmed -> processing -> shipped -> delivered
 *                                                      |
 *                                                      v
 *                                                   returned
 * 
 * Cancellation: pending, confirmed, processing -> cancelled
 */
const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['returned'],
  cancelled: [],      // Terminal state
  returned: [],       // Terminal state
};

/**
 * Check if a transition is valid
 */
export function isValidOrderTransition(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get valid next statuses
 */
export function getValidOrderTransitions(status: OrderStatus): OrderStatus[] {
  return ORDER_TRANSITIONS[status] ?? [];
}

/**
 * Check if order is in terminal state
 */
export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status]?.length === 0;
}

/**
 * Check if order can be cancelled
 */
export function canCancelOrder(status: OrderStatus): boolean {
  return ['pending', 'confirmed', 'processing'].includes(status);
}

/**
 * Check if order can be returned
 */
export function canReturnOrder(status: OrderStatus): boolean {
  return status === 'delivered';
}

/**
 * Check if order has been fulfilled (shipped or beyond)
 */
export function isFulfilledOrder(status: OrderStatus): boolean {
  return ['shipped', 'delivered', 'returned'].includes(status);
}

// ─────────────────────────────────────────────────────────────
// Payment Status Transitions
// ─────────────────────────────────────────────────────────────

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['authorized', 'captured', 'failed'],
  authorized: ['captured', 'failed'],
  captured: ['partially_refunded', 'refunded'],
  partially_refunded: ['refunded'],
  refunded: [],       // Terminal state
  failed: [],         // Terminal state
};

/**
 * Check if payment transition is valid
 */
export function isValidPaymentTransition(
  from: PaymentStatus,
  to: PaymentStatus
): boolean {
  return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check if payment is complete
 */
export function isPaymentComplete(status: PaymentStatus): boolean {
  return status === 'captured';
}

/**
 * Check if payment has any refund
 */
export function hasRefund(status: PaymentStatus): boolean {
  return ['partially_refunded', 'refunded'].includes(status);
}

// ─────────────────────────────────────────────────────────────
// Shipment Status Transitions
// ─────────────────────────────────────────────────────────────

const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  label_created: ['picked_up', 'exception'],
  picked_up: ['in_transit', 'exception'],
  in_transit: ['out_for_delivery', 'exception'],
  out_for_delivery: ['delivered', 'exception'],
  delivered: [],      // Terminal state
  exception: ['in_transit', 'out_for_delivery'], // Can recover
};

/**
 * Check if shipment transition is valid
 */
export function isValidShipmentTransition(
  from: ShipmentStatus,
  to: ShipmentStatus
): boolean {
  return SHIPMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check if shipment is in transit
 */
export function isShipmentInProgress(status: ShipmentStatus): boolean {
  return ['picked_up', 'in_transit', 'out_for_delivery'].includes(status);
}

/**
 * Check if shipment is delivered
 */
export function isShipmentDelivered(status: ShipmentStatus): boolean {
  return status === 'delivered';
}

// ─────────────────────────────────────────────────────────────
// Return Status Transitions
// ─────────────────────────────────────────────────────────────

const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ['approved', 'rejected'],
  approved: ['in_transit'],
  rejected: [],       // Terminal state
  in_transit: ['received'],
  received: ['refunded'],
  refunded: [],       // Terminal state
};

/**
 * Check if return transition is valid
 */
export function isValidReturnTransition(
  from: ReturnStatus,
  to: ReturnStatus
): boolean {
  return RETURN_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check if return is pending approval
 */
export function isReturnPendingApproval(status: ReturnStatus): boolean {
  return status === 'requested';
}

/**
 * Check if return is complete
 */
export function isReturnComplete(status: ReturnStatus): boolean {
  return ['rejected', 'refunded'].includes(status);
}

// ─────────────────────────────────────────────────────────────
// Status Mapping from Wix
// ─────────────────────────────────────────────────────────────

/**
 * Map Wix order status to UCP status
 */
export function mapWixOrderStatus(
  wixStatus: string,
  paymentStatus: string,
  fulfillmentStatus: string
): OrderStatus {
  // If cancelled, return immediately
  if (wixStatus === 'CANCELED') {
    return 'cancelled';
  }

  // Map based on fulfillment status first
  switch (fulfillmentStatus) {
    case 'FULFILLED':
      return 'delivered'; // Assume delivered if fulfilled
    case 'PARTIALLY_FULFILLED':
      return 'shipped';
    case 'NOT_FULFILLED':
    default:
      // Fall through to payment status check
      break;
  }

  // Map based on payment status
  switch (paymentStatus) {
    case 'PAID':
    case 'PARTIALLY_PAID':
      return 'confirmed';
    case 'NOT_PAID':
    case 'PENDING':
      return 'pending';
    case 'REFUNDED':
    case 'PARTIALLY_REFUNDED':
      return 'returned';
    default:
      return 'pending';
  }
}

/**
 * Map Wix payment status to UCP status
 */
export function mapWixPaymentStatus(wixPaymentStatus: string): PaymentStatus {
  const statusMap: Record<string, PaymentStatus> = {
    'PAID': 'captured',
    'PARTIALLY_PAID': 'captured',
    'NOT_PAID': 'pending',
    'PENDING': 'pending',
    'REFUNDED': 'refunded',
    'PARTIALLY_REFUNDED': 'partially_refunded',
  };

  return statusMap[wixPaymentStatus] ?? 'pending';
}

/**
 * Map Wix fulfillment status to shipment status
 */
export function mapWixFulfillmentStatus(
  wixFulfillmentStatus: string
): ShipmentStatus | null {
  const statusMap: Record<string, ShipmentStatus> = {
    'FULFILLED': 'delivered',
    'PARTIALLY_FULFILLED': 'in_transit',
    'NOT_FULFILLED': 'label_created',
  };

  return statusMap[wixFulfillmentStatus] ?? null;
}

// ─────────────────────────────────────────────────────────────
// Order Status Display
// ─────────────────────────────────────────────────────────────

/**
 * Get human-readable status label
 */
export function getOrderStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    pending: 'Order Placed',
    confirmed: 'Payment Confirmed',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    returned: 'Returned',
  };

  return labels[status] ?? status;
}

/**
 * Get status color for UI
 */
export function getOrderStatusColor(status: OrderStatus): string {
  const colors: Record<OrderStatus, string> = {
    pending: 'yellow',
    confirmed: 'blue',
    processing: 'blue',
    shipped: 'purple',
    delivered: 'green',
    cancelled: 'red',
    returned: 'gray',
  };

  return colors[status] ?? 'gray';
}
