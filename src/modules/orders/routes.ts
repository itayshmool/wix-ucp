/**
 * Order Routes
 * 
 * Fastify routes for UCP Order Management.
 * See: .cursor/rules/modules/orders.mdc
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { logger } from '../../lib/logger.js';
import { getTokenManager } from '../identity/token-manager.js';
import { createOrderService, OrderService } from './service.js';
import type {
  OrderResponse,
  ListOrdersParams,
  ListOrdersResponse,
  TrackingResponse,
  ReturnRequest,
  ReturnResponse,
  OrderStatus,
} from './types.js';

// ─────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────

const OrderIdParamSchema = z.object({
  orderId: z.string().min(1),
});

const ListOrdersQuerySchema = z.object({
  status: z.enum([
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'returned',
  ]).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
});

const ReturnRequestSchema = z.object({
  lineItems: z.array(z.object({
    id: z.string().min(1),
    quantity: z.number().int().min(1),
    reason: z.enum([
      'defective',
      'not_as_described',
      'wrong_item',
      'no_longer_needed',
      'other',
    ]),
    notes: z.string().optional(),
  })).min(1),
});

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Extract bearer token
 */
function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Validate access token and return member ID
 */
async function validateAndGetMemberId(authHeader?: string): Promise<string | null> {
  const token = extractBearerToken(authHeader);
  if (!token) {
    return null;
  }

  const tokenManager = getTokenManager();
  const claims = await tokenManager.validateAccessToken(token);
  return claims?.sub ?? null;
}

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

/**
 * Register order routes
 */
export async function orderRoutes(fastify: FastifyInstance): Promise<void> {
  const orderService = createOrderService(fastify.log);

  // ─────────────────────────────────────────────────────────────
  // GET /orders/:orderId - Get order by ID
  // ─────────────────────────────────────────────────────────────

  fastify.get<{
    Params: { orderId: string };
  }>(
    '/orders/:orderId',
    {
      schema: {
        description: 'Get order details by ID',
        tags: ['Orders'],
        params: {
          type: 'object',
          required: ['orderId'],
          properties: {
            orderId: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Order details',
            type: 'object',
          },
          404: {
            description: 'Order not found',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const parseResult = OrderIdParamSchema.safeParse(request.params);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Invalid order ID',
        });
      }

      const { orderId } = parseResult.data;
      const order = await orderService.getOrder(orderId);
      return reply.send(order);
    }
  );

  // ─────────────────────────────────────────────────────────────
  // GET /orders - List orders (requires auth)
  // ─────────────────────────────────────────────────────────────

  fastify.get<{
    Querystring: ListOrdersParams;
  }>(
    '/orders',
    {
      schema: {
        description: 'List orders for authenticated member',
        tags: ['Orders'],
        headers: {
          type: 'object',
          properties: {
            authorization: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            limit: { type: 'number', default: 20 },
            cursor: { type: 'string' },
            createdAfter: { type: 'string', format: 'date-time' },
            createdBefore: { type: 'string', format: 'date-time' },
          },
        },
        response: {
          200: {
            description: 'List of orders',
            type: 'object',
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      // Validate auth
      const memberId = await validateAndGetMemberId(request.headers.authorization);
      if (!memberId) {
        return reply.status(401).send({
          error: 'UNAUTHORIZED',
          message: 'Valid access token required',
        });
      }

      const parseResult = ListOrdersQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Invalid query parameters',
        });
      }

      const params = parseResult.data;
      const response = await orderService.listOrders(memberId, params);
      return reply.send(response);
    }
  );

  // ─────────────────────────────────────────────────────────────
  // GET /orders/:orderId/tracking - Get tracking info
  // ─────────────────────────────────────────────────────────────

  fastify.get<{
    Params: { orderId: string };
  }>(
    '/orders/:orderId/tracking',
    {
      schema: {
        description: 'Get shipment tracking information',
        tags: ['Orders'],
        params: {
          type: 'object',
          required: ['orderId'],
          properties: {
            orderId: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Tracking information',
            type: 'object',
          },
          404: {
            description: 'Order not found',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      const parseResult = OrderIdParamSchema.safeParse(request.params);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Invalid order ID',
        });
      }

      const { orderId } = parseResult.data;
      const tracking = await orderService.getTracking(orderId);
      return reply.send(tracking);
    }
  );

  // ─────────────────────────────────────────────────────────────
  // POST /orders/:orderId/return - Initiate return
  // ─────────────────────────────────────────────────────────────

  fastify.post<{
    Params: { orderId: string };
    Body: ReturnRequest;
  }>(
    '/orders/:orderId/return',
    {
      schema: {
        description: 'Initiate a return for an order',
        tags: ['Orders'],
        params: {
          type: 'object',
          required: ['orderId'],
          properties: {
            orderId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['lineItems'],
          properties: {
            lineItems: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'quantity', 'reason'],
                properties: {
                  id: { type: 'string' },
                  quantity: { type: 'number', minimum: 1 },
                  reason: { type: 'string' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        response: {
          201: {
            description: 'Return created',
            type: 'object',
          },
          400: {
            description: 'Invalid request',
            type: 'object',
          },
          404: {
            description: 'Order not found',
            type: 'object',
          },
          410: {
            description: 'Return window expired',
            type: 'object',
          },
          422: {
            description: 'Order not returnable',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      const paramResult = OrderIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Invalid order ID',
        });
      }

      const bodyResult = ReturnRequestSchema.safeParse(request.body);
      if (!bodyResult.success) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Invalid return request',
          details: bodyResult.error.errors,
        });
      }

      const { orderId } = paramResult.data;
      const returnRequest = bodyResult.data;

      const returnResponse = await orderService.initiateReturn(orderId, returnRequest);
      return reply.status(201).send(returnResponse);
    }
  );

  // ─────────────────────────────────────────────────────────────
  // GET /orders/:orderId/returnable - Check return eligibility
  // ─────────────────────────────────────────────────────────────

  fastify.get<{
    Params: { orderId: string };
  }>(
    '/orders/:orderId/returnable',
    {
      schema: {
        description: 'Check if order is eligible for return',
        tags: ['Orders'],
        params: {
          type: 'object',
          required: ['orderId'],
          properties: {
            orderId: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Return eligibility',
            type: 'object',
            properties: {
              returnable: { type: 'boolean' },
              reason: { type: 'string' },
              deadline: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const parseResult = OrderIdParamSchema.safeParse(request.params);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Invalid order ID',
        });
      }

      const { orderId } = parseResult.data;
      const result = await orderService.isReturnable(orderId);
      return reply.send(result);
    }
  );

  // ─────────────────────────────────────────────────────────────
  // DELETE /orders/:orderId - Cancel order
  // ─────────────────────────────────────────────────────────────

  fastify.delete<{
    Params: { orderId: string };
  }>(
    '/orders/:orderId',
    {
      schema: {
        description: 'Cancel an order (if eligible)',
        tags: ['Orders'],
        params: {
          type: 'object',
          required: ['orderId'],
          properties: {
            orderId: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Order cancelled',
            type: 'object',
          },
          404: {
            description: 'Order not found',
            type: 'object',
          },
          409: {
            description: 'Order cannot be cancelled',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      const parseResult = OrderIdParamSchema.safeParse(request.params);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Invalid order ID',
        });
      }

      const { orderId } = parseResult.data;
      const order = await orderService.cancelOrder(orderId);
      return reply.send(order);
    }
  );

  // ─────────────────────────────────────────────────────────────
  // GET /returns/:returnId - Get return status
  // ─────────────────────────────────────────────────────────────

  fastify.get<{
    Params: { returnId: string };
  }>(
    '/returns/:returnId',
    {
      schema: {
        description: 'Get return request status',
        tags: ['Orders'],
        params: {
          type: 'object',
          required: ['returnId'],
          properties: {
            returnId: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Return status',
            type: 'object',
          },
          404: {
            description: 'Return not found',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      const { returnId } = request.params;
      const returnStatus = await orderService.getReturnStatus(returnId);

      if (!returnStatus) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Return ${returnId} not found`,
        });
      }

      return reply.send(returnStatus);
    }
  );

  logger.info('Order routes registered');
}
