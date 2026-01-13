/**
 * Order Tool Handlers
 * 
 * MCP handlers for order operations.
 */

import { createOrderService } from '../../orders/service.js';
import type { MCPContext, MCPToolResult, ToolHandler } from '../types.js';

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
// Mock Order Data
// ─────────────────────────────────────────────────────────────

const MOCK_ORDERS = [
  {
    id: 'order_001',
    confirmationNumber: '1001',
    status: 'delivered',
    total: 6047,
    currency: 'USD',
    itemCount: 2,
    createdAt: '2026-01-10T10:00:00Z',
    items: [
      { name: 'Premium Wireless Headphones', quantity: 1, price: 14999 },
      { name: 'Organic Cotton T-Shirt', quantity: 2, price: 2999 },
    ],
    shippingAddress: {
      line1: '123 Main St',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'US',
    },
    tracking: {
      carrier: 'UPS',
      trackingNumber: '1Z999AA10123456784',
      status: 'delivered',
    },
  },
  {
    id: 'order_002',
    confirmationNumber: '1002',
    status: 'shipped',
    total: 4999,
    currency: 'USD',
    itemCount: 1,
    createdAt: '2026-01-12T14:30:00Z',
    items: [
      { name: 'Yoga Mat Pro', quantity: 1, price: 4999 },
    ],
    shippingAddress: {
      line1: '456 Oak Ave',
      city: 'Los Angeles',
      state: 'CA',
      postalCode: '90001',
      country: 'US',
    },
    tracking: {
      carrier: 'FedEx',
      trackingNumber: '794644790132',
      status: 'in_transit',
      estimatedDelivery: '2026-01-16',
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────

const getOrder: ToolHandler = async (args, context) => {
  const orderId = args.orderId as string | undefined;

  if (!orderId) {
    return createErrorResult('orderId is required');
  }

  // Try mock data first
  const mockOrder = MOCK_ORDERS.find(o => o.id === orderId);
  
  if (mockOrder) {
    return createTextResult({
      orderId: mockOrder.id,
      confirmationNumber: mockOrder.confirmationNumber,
      status: mockOrder.status,
      total: formatPrice(mockOrder.total, mockOrder.currency),
      itemCount: mockOrder.itemCount,
      items: mockOrder.items.map(i => ({
        name: i.name,
        quantity: i.quantity,
        price: formatPrice(i.price, mockOrder.currency),
      })),
      shippingAddress: mockOrder.shippingAddress,
      tracking: mockOrder.tracking,
      createdAt: mockOrder.createdAt,
      message: getOrderStatusMessage(mockOrder.status),
      actions: getOrderActions(mockOrder.status),
    });
  }

  // Try real service
  try {
    const orderService = createOrderService();
    const order = await orderService.getOrder(orderId);

    const total = order.totals.find(t => t.type === 'TOTAL');

    return createTextResult({
      orderId: order.id,
      confirmationNumber: order.confirmationNumber,
      status: order.status,
      total: total ? formatPrice(total.amount, order.currency) : undefined,
      itemCount: order.lineItems.length,
      items: order.lineItems.map(li => ({
        name: li.name,
        quantity: li.quantity,
        price: formatPrice(li.totalPrice.amount, li.totalPrice.currency),
      })),
      buyer: order.buyer,
      fulfillment: order.fulfillment,
      createdAt: order.createdAt,
      message: getOrderStatusMessage(order.status),
      actions: getOrderActions(order.status),
    });
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error.message : 'Order not found'
    );
  }
};

const listOrders: ToolHandler = async (args, context) => {
  const limit = (args.limit as number | undefined) ?? 10;
  const status = args.status as 'pending' | 'shipped' | 'delivered' | 'cancelled' | undefined;

  // Filter mock orders
  let orders = [...MOCK_ORDERS];
  
  if (status) {
    orders = orders.filter(o => o.status === status);
  }

  orders = orders.slice(0, limit);

  return createTextResult({
    orders: orders.map(o => ({
      orderId: o.id,
      confirmationNumber: o.confirmationNumber,
      status: o.status,
      total: formatPrice(o.total, o.currency),
      itemCount: o.itemCount,
      createdAt: o.createdAt,
    })),
    total: orders.length,
    message: orders.length > 0
      ? `Found ${orders.length} order(s)`
      : 'No orders found',
    hint: 'Use getOrder with an orderId for full details',
  });
};

const getOrderTracking: ToolHandler = async (args, context) => {
  const orderId = args.orderId as string | undefined;

  if (!orderId) {
    return createErrorResult('orderId is required');
  }

  // Find mock order
  const mockOrder = MOCK_ORDERS.find(o => o.id === orderId);

  if (mockOrder?.tracking) {
    const events = generateMockTrackingEvents(mockOrder.tracking.status);

    return createTextResult({
      orderId: mockOrder.id,
      carrier: mockOrder.tracking.carrier,
      trackingNumber: mockOrder.tracking.trackingNumber,
      status: mockOrder.tracking.status,
      estimatedDelivery: mockOrder.tracking.estimatedDelivery,
      trackingUrl: `https://www.ups.com/track?tracknum=${mockOrder.tracking.trackingNumber}`,
      events,
      message: getTrackingMessage(mockOrder.tracking.status),
    });
  }

  // Try real service
  try {
    const orderService = createOrderService();
    const tracking = await orderService.getTracking(orderId);

    if (tracking.shipments.length === 0) {
      return createTextResult({
        orderId,
        message: 'No tracking information available yet',
        hint: 'Tracking becomes available once the order is shipped',
      });
    }

    const shipment = tracking.shipments[0];
    if (!shipment) {
      return createTextResult({
        orderId,
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
      message: getTrackingMessage(shipment.status),
    });
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error.message : 'Tracking not found'
    );
  }
};

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function getOrderStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    pending: 'Order is being processed',
    confirmed: 'Payment confirmed, preparing for shipment',
    processing: 'Order is being prepared',
    shipped: 'Order has shipped and is on its way',
    delivered: 'Order has been delivered',
    cancelled: 'Order was cancelled',
    returned: 'Order has been returned',
  };

  return messages[status] ?? `Order status: ${status}`;
}

function getOrderActions(status: string): string[] {
  const actions: Record<string, string[]> = {
    pending: ['Wait for payment confirmation'],
    confirmed: ['Track shipment once shipped'],
    shipped: ['Track shipment with getOrderTracking'],
    delivered: ['Initiate return if needed'],
    cancelled: ['Create new order if desired'],
  };

  return actions[status] ?? [];
}

function getTrackingMessage(status: string): string {
  const messages: Record<string, string> = {
    label_created: 'Shipping label created, awaiting pickup',
    picked_up: 'Package picked up by carrier',
    in_transit: 'Package is in transit',
    out_for_delivery: 'Package is out for delivery today',
    delivered: 'Package has been delivered',
    exception: 'Delivery exception - contact carrier',
  };

  return messages[status] ?? `Tracking status: ${status}`;
}

function generateMockTrackingEvents(status: string): Array<{
  timestamp: string;
  status: string;
  location: string;
  description: string;
}> {
  const events = [
    {
      timestamp: '2026-01-12T10:00:00Z',
      status: 'label_created',
      location: 'Online',
      description: 'Shipping label created',
    },
    {
      timestamp: '2026-01-12T14:30:00Z',
      status: 'picked_up',
      location: 'Los Angeles, CA',
      description: 'Package picked up',
    },
  ];

  if (['in_transit', 'out_for_delivery', 'delivered'].includes(status)) {
    events.push({
      timestamp: '2026-01-13T08:00:00Z',
      status: 'in_transit',
      location: 'Phoenix, AZ',
      description: 'Package in transit',
    });
  }

  if (['out_for_delivery', 'delivered'].includes(status)) {
    events.push({
      timestamp: '2026-01-14T06:00:00Z',
      status: 'out_for_delivery',
      location: 'New York, NY',
      description: 'Out for delivery',
    });
  }

  if (status === 'delivered') {
    events.push({
      timestamp: '2026-01-14T14:30:00Z',
      status: 'delivered',
      location: 'New York, NY',
      description: 'Package delivered',
    });
  }

  return events;
}

// ─────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────

export const orderHandlers: Record<string, ToolHandler> = {
  getOrder,
  listOrders,
  getOrderTracking,
};
