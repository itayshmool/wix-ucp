/**
 * Checkout Routes
 * 
 * Fastify routes for UCP Checkout capability.
 * See: .cursor/rules/modules/checkout.mdc
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../../lib/logger.js';
import { getCheckoutService } from './service.js';
import {
  CreateCheckoutSchema,
  UpdateCheckoutSchema,
  CompleteCheckoutSchema,
  CheckoutIdParamSchema,
  type CreateCheckoutInput,
  type UpdateCheckoutInput,
  type CompleteCheckoutInput,
  type CheckoutIdParam,
} from './schemas.js';
import type { CheckoutResponse, CompleteCheckoutResponse, FulfillmentOption } from './types.js';

/**
 * Register checkout routes
 */
export async function checkoutRoutes(fastify: FastifyInstance): Promise<void> {
  const service = getCheckoutService();

  // ─────────────────────────────────────────────────────────────
  // POST /checkout-sessions - Create checkout session
  // ─────────────────────────────────────────────────────────────

  fastify.post<{
    Body: CreateCheckoutInput;
    Reply: CheckoutResponse;
  }>(
    '/checkout-sessions',
    {
      schema: {
        description: 'Create a new checkout session',
        tags: ['Checkout'],
        response: {
          201: {
            description: 'Checkout session created',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      const validated = CreateCheckoutSchema.parse(request.body);

      logger.info(
        { currency: validated.currency, itemCount: validated.lineItems.length },
        'Creating checkout session'
      );

      const checkout = await service.createCheckout({
        currency: validated.currency,
        buyer: validated.buyer,
        lineItems: validated.lineItems,
        shippingAddress: validated.shippingAddress,
        billingAddress: validated.billingAddress,
        discountCode: validated.discountCode,
        metadata: validated.metadata,
      });

      return reply.status(201).send(checkout);
    }
  );

  // ─────────────────────────────────────────────────────────────
  // GET /checkout-sessions/:checkoutId - Get checkout session
  // ─────────────────────────────────────────────────────────────

  fastify.get<{
    Params: CheckoutIdParam;
    Reply: CheckoutResponse;
  }>(
    '/checkout-sessions/:checkoutId',
    {
      schema: {
        description: 'Get checkout session by ID',
        tags: ['Checkout'],
        params: {
          type: 'object',
          properties: {
            checkoutId: { type: 'string', pattern: '^chk_[a-f0-9]{32}$' },
          },
          required: ['checkoutId'],
        },
        response: {
          200: {
            description: 'Checkout session found',
            type: 'object',
          },
          404: {
            description: 'Checkout session not found',
            type: 'object',
          },
          410: {
            description: 'Checkout session expired',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      const { checkoutId } = CheckoutIdParamSchema.parse(request.params);

      logger.debug({ checkoutId }, 'Fetching checkout session');

      const checkout = await service.getCheckout(checkoutId);

      return reply.send(checkout);
    }
  );

  // ─────────────────────────────────────────────────────────────
  // PATCH /checkout-sessions/:checkoutId - Update checkout session
  // ─────────────────────────────────────────────────────────────

  fastify.patch<{
    Params: CheckoutIdParam;
    Body: UpdateCheckoutInput;
    Reply: CheckoutResponse;
  }>(
    '/checkout-sessions/:checkoutId',
    {
      schema: {
        description: 'Update checkout session',
        tags: ['Checkout'],
        params: {
          type: 'object',
          properties: {
            checkoutId: { type: 'string', pattern: '^chk_[a-f0-9]{32}$' },
          },
          required: ['checkoutId'],
        },
        response: {
          200: {
            description: 'Checkout session updated',
            type: 'object',
          },
          404: {
            description: 'Checkout session not found',
            type: 'object',
          },
          409: {
            description: 'Cannot modify checkout in current state',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      const { checkoutId } = CheckoutIdParamSchema.parse(request.params);
      const validated = UpdateCheckoutSchema.parse(request.body);

      logger.info({ checkoutId }, 'Updating checkout session');

      const checkout = await service.updateCheckout(checkoutId, {
        buyer: validated.buyer,
        shippingAddress: validated.shippingAddress,
        billingAddress: validated.billingAddress,
        selectedFulfillment: validated.selectedFulfillment,
        discountCode: validated.discountCode ?? undefined,
      });

      return reply.send(checkout);
    }
  );

  // ─────────────────────────────────────────────────────────────
  // POST /checkout-sessions/:checkoutId/complete - Complete checkout
  // ─────────────────────────────────────────────────────────────

  fastify.post<{
    Params: CheckoutIdParam;
    Body: CompleteCheckoutInput;
    Reply: CompleteCheckoutResponse;
  }>(
    '/checkout-sessions/:checkoutId/complete',
    {
      schema: {
        description: 'Complete checkout with payment',
        tags: ['Checkout'],
        params: {
          type: 'object',
          properties: {
            checkoutId: { type: 'string', pattern: '^chk_[a-f0-9]{32}$' },
          },
          required: ['checkoutId'],
        },
        response: {
          200: {
            description: 'Checkout completed successfully',
            type: 'object',
          },
          404: {
            description: 'Checkout session not found',
            type: 'object',
          },
          409: {
            description: 'Checkout already completed or cancelled',
            type: 'object',
          },
          410: {
            description: 'Checkout session expired',
            type: 'object',
          },
          422: {
            description: 'Payment processing failed',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      const { checkoutId } = CheckoutIdParamSchema.parse(request.params);
      const validated = CompleteCheckoutSchema.parse(request.body);

      logger.info(
        { checkoutId, handlerId: validated.paymentData.handlerId },
        'Completing checkout'
      );

      const result = await service.completeCheckout(checkoutId, {
        paymentData: validated.paymentData,
        idempotencyKey: validated.idempotencyKey,
      });

      return reply.send(result);
    }
  );

  // ─────────────────────────────────────────────────────────────
  // DELETE /checkout-sessions/:checkoutId - Cancel checkout
  // ─────────────────────────────────────────────────────────────

  fastify.delete<{
    Params: CheckoutIdParam;
  }>(
    '/checkout-sessions/:checkoutId',
    {
      schema: {
        description: 'Cancel checkout session',
        tags: ['Checkout'],
        params: {
          type: 'object',
          properties: {
            checkoutId: { type: 'string', pattern: '^chk_[a-f0-9]{32}$' },
          },
          required: ['checkoutId'],
        },
        response: {
          204: {
            description: 'Checkout session cancelled',
            type: 'null',
          },
          404: {
            description: 'Checkout session not found',
            type: 'object',
          },
          409: {
            description: 'Cannot cancel completed checkout',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      const { checkoutId } = CheckoutIdParamSchema.parse(request.params);

      logger.info({ checkoutId }, 'Cancelling checkout session');

      await service.cancelCheckout(checkoutId);

      return reply.status(204).send();
    }
  );

  // ─────────────────────────────────────────────────────────────
  // GET /checkout-sessions/:checkoutId/fulfillment-options
  // ─────────────────────────────────────────────────────────────

  fastify.get<{
    Params: CheckoutIdParam;
    Reply: { options: FulfillmentOption[] };
  }>(
    '/checkout-sessions/:checkoutId/fulfillment-options',
    {
      schema: {
        description: 'Get available fulfillment options for checkout',
        tags: ['Checkout'],
        params: {
          type: 'object',
          properties: {
            checkoutId: { type: 'string', pattern: '^chk_[a-f0-9]{32}$' },
          },
          required: ['checkoutId'],
        },
        response: {
          200: {
            description: 'Fulfillment options retrieved',
            type: 'object',
            properties: {
              options: {
                type: 'array',
                items: {
                  type: 'object',
                },
              },
            },
          },
          404: {
            description: 'Checkout session not found',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      const { checkoutId } = CheckoutIdParamSchema.parse(request.params);

      logger.debug({ checkoutId }, 'Fetching fulfillment options');

      const options = await service.getFulfillmentOptions(checkoutId);

      return reply.send({ options });
    }
  );

  logger.info('Checkout routes registered');
}
