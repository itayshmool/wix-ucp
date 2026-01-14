/**
 * Order Tool Handlers
 * 
 * MCP handlers for order operations.
 * Uses OrderService which respects DEMO_MODE for mock vs real APIs.
 */

import { createOrderService } from '../../orders/service.js';
import { getWixEcommerceClient } from '../../../adapters/wix/ecommerce.js';
import type { MCPToolResult, ToolHandler } from '../types.js';

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount / 100);
}

function createTextResult(data: unknown): MCPToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function createErrorResult(message: string): MCPToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: true, message }),
      },
    ],
    isError: true,
  };
}

// ─────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────

const getOrder: ToolHandler = async (args, context) => {
  const orderId = args.orderId as string | undefined;

  if (!orderId) {
    return createErrorResult('orderId is required');
  }

  try {
    const orderService = createOrderService();
    const client = getWixEcommerceClient(context.forceMode);
    const order = await orderService.getOrder(orderId);

    const total = order.totals.find((t) => t.type === 'TOTAL');

    return createTextResult({
      orderId: order.id,
      confirmationNumber: order.confirmationNumber,
      status: order.status,
      total: total ? formatPrice(total.amount, order.currency) : undefined,
      itemCount: order.lineItems.length,
      items: order.lineItems.map((li) => ({
        name: li.name,
        quantity: li.quantity,
        price: formatPrice(li.totalPrice.amount, li.totalPrice.currency),
      })),
      buyer: order.buyer,
      fulfillment: order.fulfillment,
      createdAt: order.createdAt,
      mode: client.isInMockMode() ? 'demo' : 'live',
      message: getOrderStatusMessage(order.status),
      actions: getOrderActions(order.status),
    });
  } catch (error) {
    return createErrorResult(error instanceof Error ? error.message : 'Order not found');
  }
};

const listOrders: ToolHandler = async (args, context) => {
  const limit = (args.limit as number | undefined) ?? 10;
  const status = args.status as 'pending' | 'shipped' | 'delivered' | 'cancelled' | undefined;

  try {
    const orderService = createOrderService();
    const client = getWixEcommerceClient(context.forceMode);
    
    // listOrders requires memberId - use 'visitor' for anonymous sessions
    // status is already in the correct format (lowercase)
    const response = await orderService.listOrders('visitor', {
      limit,
      status,
    });

    return createTextResult({
      orders: response.orders.map((o) => ({
        orderId: o.id,
        confirmationNumber: o.confirmationNumber,
        status: o.status,
        total: formatPrice(o.total.amount, o.total.currency),
        itemCount: o.itemCount,
        createdAt: o.createdAt,
      })),
      total: response.orders.length,
      mode: client.isInMockMode() ? 'demo' : 'live',
      message: response.orders.length > 0 ? `Found ${response.orders.length} order(s)` : 'No orders found',
      hint: 'Use getOrder with an orderId for full details',
    });
  } catch (error) {
    return createErrorResult(error instanceof Error ? error.message : 'Failed to list orders');
  }
};

const getOrderTracking: ToolHandler = async (args, context) => {
  const orderId = args.orderId as string | undefined;

  if (!orderId) {
    return createErrorResult('orderId is required');
  }

  try {
    const orderService = createOrderService();
    const client = getWixEcommerceClient(context.forceMode);
    const tracking = await orderService.getTracking(orderId);

    if (tracking.shipments.length === 0) {
      return createTextResult({
        orderId,
        mode: client.isInMockMode() ? 'demo' : 'live',
        message: 'No tracking information available yet',
        hint: 'Tracking becomes available once the order is shipped',
      });
    }

    const shipment = tracking.shipments[0];
    if (!shipment) {
      return createTextResult({
        orderId,
        mode: client.isInMockMode() ? 'demo' : 'live',
        message: 'No tracking information available yet',
        hint: 'Tracking becomes available once the order is shipped',
      });
    }

    return createTextResult({
      orderId,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      status: shipment.status,
      trackingUrl: shipment.trackingUrl,
      estimatedDelivery: shipment.estimatedDelivery,
      events: shipment.events,
      mode: client.isInMockMode() ? 'demo' : 'live',
      message: getTrackingMessage(shipment.status),
    });
  } catch (error) {
    return createErrorResult(error instanceof Error ? error.message : 'Tracking not found');
  }
};

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function getOrderStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    PENDING: 'Order is being processed',
    CONFIRMED: 'Payment confirmed, preparing for shipment',
    PROCESSING: 'Order is being prepared',
    SHIPPED: 'Order has shipped and is on its way',
    DELIVERED: 'Order has been delivered',
    CANCELLED: 'Order was cancelled',
    RETURNED: 'Order has been returned',
  };

  return messages[status] ?? `Order status: ${status}`;
}

function getOrderActions(status: string): string[] {
  const actions: Record<string, string[]> = {
    PENDING: ['Wait for payment confirmation'],
    CONFIRMED: ['Track shipment once shipped'],
    SHIPPED: ['Track shipment with getOrderTracking'],
    DELIVERED: ['Initiate return if needed'],
    CANCELLED: ['Create new order if desired'],
  };

  return actions[status] ?? [];
}

function getTrackingMessage(status: string): string {
  const messages: Record<string, string> = {
    LABEL_CREATED: 'Shipping label created, awaiting pickup',
    PICKED_UP: 'Package picked up by carrier',
    IN_TRANSIT: 'Package is in transit',
    OUT_FOR_DELIVERY: 'Package is out for delivery today',
    DELIVERED: 'Package has been delivered',
    EXCEPTION: 'Delivery exception - contact carrier',
  };

  return messages[status] ?? `Tracking status: ${status}`;
}

// ─────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────

export const orderHandlers: Record<string, ToolHandler> = {
  getOrder,
  listOrders,
  getOrderTracking,
};
