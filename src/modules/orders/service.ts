/**
 * Order Service
 * 
 * Core service for order management operations.
 * See: .cursor/rules/modules/orders.mdc
 */

import type { FastifyBaseLogger } from 'fastify';
import { logger as defaultLogger } from '../../lib/logger.js';
import { getRedis, setWithTTL, getJSON, deleteKey } from '../../lib/redis.js';
import { prisma } from '../../lib/prisma.js';
import { createWixEcommerceClient, type WixEcommerceClient } from '../../adapters/wix/ecommerce.js';
import { UCPException } from '../../core/types/errors.js';
import type {
  OrderResponse,
  OrderSummary,
  ListOrdersParams,
  ListOrdersResponse,
  TrackingResponse,
  ReturnRequest,
  ReturnResponse,
  Shipment,
  OrderStatus,
  ORDER_CACHE_TTL,
} from './types.js';
import { ORDER_CACHE_TTL as CACHE_TTL, DEFAULT_RETURN_POLICY } from './types.js';
import {
  mapWixOrderToUCP,
  mapWixOrderToSummary,
  mapWixFulfillmentsToShipments,
  type WixOrder,
} from './mappers.js';
import { canCancelOrder, canReturnOrder } from './state-machine.js';

// ─────────────────────────────────────────────────────────────
// Redis Key Helpers
// ─────────────────────────────────────────────────────────────

const REDIS_PREFIX = {
  ORDER: 'order:',
  TRACKING: 'order:tracking:',
  RETURN: 'return:',
};

function orderKey(orderId: string): string {
  return `${REDIS_PREFIX.ORDER}${orderId}`;
}

function trackingKey(orderId: string): string {
  return `${REDIS_PREFIX.TRACKING}${orderId}`;
}

function returnKey(returnId: string): string {
  return `${REDIS_PREFIX.RETURN}${returnId}`;
}

// ─────────────────────────────────────────────────────────────
// Order Service
// ─────────────────────────────────────────────────────────────

export class OrderService {
  private logger: FastifyBaseLogger;
  private wixClient: WixEcommerceClient;

  constructor(logger?: FastifyBaseLogger) {
    this.logger = (logger ?? defaultLogger) as FastifyBaseLogger;
    this.wixClient = createWixEcommerceClient();
  }

  // ─────────────────────────────────────────────────────────────
  // Get Order
  // ─────────────────────────────────────────────────────────────

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<OrderResponse> {
    // Try cache first
    const cached = await getJSON<OrderResponse>(orderKey(orderId));
    if (cached) {
      this.logger.debug({ orderId }, 'Order cache hit');
      return cached;
    }

    // Fetch from Wix
    try {
      const wixOrder = await this.wixClient.getOrder(orderId);
      const order = mapWixOrderToUCP(wixOrder as WixOrder);

      // Cache based on status
      const ttl = CACHE_TTL[order.status];
      await setWithTTL(orderKey(orderId), order, ttl);

      this.logger.debug({ orderId, status: order.status }, 'Order fetched from Wix');

      return order;
    } catch (error) {
      this.logger.error({ error, orderId }, 'Failed to fetch order');
      throw new UCPException('NOT_FOUND', `Order ${orderId} not found`);
    }
  }

  /**
   * Get order by checkout ID
   */
  async getOrderByCheckout(checkoutId: string): Promise<OrderResponse | null> {
    // Try to find in cache first
    try {
      const response = await this.wixClient.listOrders({
        paging: { limit: 10 },
      });

      // Find order with matching checkout ID
      const matchingOrder = response.orders.find(
        (o) => (o as WixOrder).checkoutId === checkoutId
      );

      if (!matchingOrder) {
        return null;
      }

      return mapWixOrderToUCP(matchingOrder as WixOrder);
    } catch (error) {
      this.logger.error({ error, checkoutId }, 'Failed to find order by checkout');
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // List Orders
  // ─────────────────────────────────────────────────────────────

  /**
   * List orders for a member
   */
  async listOrders(
    memberId: string,
    params: ListOrdersParams
  ): Promise<ListOrdersResponse> {
    const limit = Math.min(params.limit ?? 20, 100);

    try {
      const wixStatus = params.status ? mapStatusToWix(params.status) : undefined;
      const response = await this.wixClient.listOrders({
        paging: { limit },
        filter: wixStatus ? { status: wixStatus } : undefined,
      });

      const orders: OrderSummary[] = response.orders.map((o) =>
        mapWixOrderToSummary(o as WixOrder)
      );

      return {
        orders,
        pagination: {
          cursor: undefined, // Wix uses offset pagination in mock mode
          hasMore: orders.length === limit,
        },
      };
    } catch (error) {
      this.logger.error({ error, memberId }, 'Failed to list orders');
      throw new UCPException('INTERNAL_ERROR', 'Failed to list orders');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Tracking
  // ─────────────────────────────────────────────────────────────

  /**
   * Get tracking information for an order
   */
  async getTracking(orderId: string): Promise<TrackingResponse> {
    // Try cache first
    const cached = await getJSON<TrackingResponse>(trackingKey(orderId));
    if (cached) {
      return cached;
    }

    // Get order to extract fulfillments
    const order = await this.getOrder(orderId);

    // Get Wix order for fulfillment details
    try {
      const wixOrder = await this.wixClient.getOrder(orderId);
      const shipments = mapWixFulfillmentsToShipments(
        (wixOrder as WixOrder).fulfillments
      );

      const tracking: TrackingResponse = {
        orderId,
        shipments,
      };

      // Cache for 5 minutes
      await setWithTTL(trackingKey(orderId), tracking, 300);

      return tracking;
    } catch (error) {
      // Return empty tracking if no fulfillments
      return {
        orderId,
        shipments: [],
      };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Returns
  // ─────────────────────────────────────────────────────────────

  /**
   * Check if order is returnable
   */
  async isReturnable(orderId: string): Promise<{
    returnable: boolean;
    reason?: string;
    deadline?: string;
  }> {
    const order = await this.getOrder(orderId);

    // Check if order status allows returns
    if (!canReturnOrder(order.status)) {
      return {
        returnable: false,
        reason: `Order cannot be returned in ${order.status} status`,
      };
    }

    // Check return window
    const deliveredDate = new Date(order.updatedAt);
    const deadline = new Date(deliveredDate);
    deadline.setDate(deadline.getDate() + DEFAULT_RETURN_POLICY.windowDays);

    if (new Date() > deadline) {
      return {
        returnable: false,
        reason: 'Return window has expired',
        deadline: deadline.toISOString(),
      };
    }

    return {
      returnable: true,
      deadline: deadline.toISOString(),
    };
  }

  /**
   * Initiate a return
   */
  async initiateReturn(
    orderId: string,
    request: ReturnRequest
  ): Promise<ReturnResponse> {
    // Check if returnable
    const returnability = await this.isReturnable(orderId);
    if (!returnability.returnable) {
      throw new UCPException('UNPROCESSABLE', returnability.reason ?? 'Order cannot be returned');
    }

    const order = await this.getOrder(orderId);

    // Validate line items exist
    for (const item of request.lineItems) {
      const orderItem = order.lineItems.find((li) => li.id === item.id);
      if (!orderItem) {
        throw new UCPException('INVALID_FIELD', `Line item ${item.id} not found in order`);
      }
      if (item.quantity > orderItem.quantity) {
        throw new UCPException(
          'INVALID_FIELD',
          `Cannot return more than ${orderItem.quantity} of item ${item.id}`
        );
      }
    }

    // Create return record
    const returnId = `ret_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const returnLineItems = request.lineItems.map((item) => {
      const orderItem = order.lineItems.find((li) => li.id === item.id)!;
      return {
        id: item.id,
        name: orderItem.name,
        quantity: item.quantity,
        reason: item.reason,
        refundAmount: {
          amount: Math.round((orderItem.unitPrice.amount * item.quantity)),
          currency: order.currency,
        },
      };
    });

    const totalRefund = returnLineItems.reduce(
      (sum, item) => sum + item.refundAmount.amount,
      0
    );

    const returnResponse: ReturnResponse = {
      returnId,
      orderId,
      status: 'requested',
      lineItems: returnLineItems,
      refundAmount: {
        amount: totalRefund,
        currency: order.currency,
      },
      instructions: 'Please pack items securely and ship within 7 days.',
      createdAt: new Date().toISOString(),
    };

    // Store return in Redis
    await setWithTTL(returnKey(returnId), returnResponse, 30 * 24 * 60 * 60);

    this.logger.info(
      { orderId, returnId, itemCount: request.lineItems.length },
      'Return initiated'
    );

    return returnResponse;
  }

  /**
   * Get return status
   */
  async getReturnStatus(returnId: string): Promise<ReturnResponse | null> {
    return getJSON<ReturnResponse>(returnKey(returnId));
  }

  // ─────────────────────────────────────────────────────────────
  // Cancel Order
  // ─────────────────────────────────────────────────────────────

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<OrderResponse> {
    const order = await this.getOrder(orderId);

    if (!canCancelOrder(order.status)) {
      throw new UCPException(
        'CONFLICT',
        `Order cannot be cancelled in ${order.status} status`
      );
    }

    try {
      const cancelledOrder = await this.wixClient.cancelOrder(orderId);

      // Invalidate cache
      await deleteKey(orderKey(orderId));

      const mappedOrder = mapWixOrderToUCP(cancelledOrder as WixOrder);

      this.logger.info({ orderId }, 'Order cancelled');

      return mappedOrder;
    } catch (error) {
      this.logger.error({ error, orderId }, 'Failed to cancel order');
      throw new UCPException('INTERNAL_ERROR', 'Failed to cancel order');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Cache Management
  // ─────────────────────────────────────────────────────────────

  /**
   * Invalidate order cache
   */
  async invalidateCache(orderId: string): Promise<void> {
    await deleteKey(orderKey(orderId));
    await deleteKey(trackingKey(orderId));
    this.logger.debug({ orderId }, 'Order cache invalidated');
  }
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

type WixOrderFilterStatus = 'APPROVED' | 'INITIALIZED' | 'CANCELED' | 'FULFILLED';

/**
 * Map UCP status to Wix status filter
 */
function mapStatusToWix(status: OrderStatus): WixOrderFilterStatus | undefined {
  const statusMap: Partial<Record<OrderStatus, WixOrderFilterStatus>> = {
    pending: 'INITIALIZED',
    confirmed: 'APPROVED',
    cancelled: 'CANCELED',
    delivered: 'FULFILLED',
  };

  return statusMap[status];
}

/**
 * Create order service instance
 */
export function createOrderService(logger?: FastifyBaseLogger): OrderService {
  return new OrderService(logger);
}
