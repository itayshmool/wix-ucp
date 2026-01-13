/**
 * Payment Handler API Routes
 * 
 * Fastify routes for payment tokenization and detokenization.
 * See: .cursor/rules/modules/payment-handler.mdc
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { UCPException } from '../../core/types/errors.js';
import { createDefaultHandler, WixPaymentsHandler } from './handler.js';
import {
  TokenizeRequestSchema,
  DetokenizeRequestSchema,
  type TokenizeRequestInput,
  type DetokenizeRequestInput,
} from './schemas.js';

// Lazy-initialized handler instance
let handlerInstance: WixPaymentsHandler | null = null;

/**
 * Get or create the payment handler instance
 */
function getHandler(): WixPaymentsHandler {
  if (!handlerInstance) {
    handlerInstance = createDefaultHandler();
  }
  return handlerInstance;
}

/**
 * Payment Handler Routes
 * 
 * Registers:
 * - POST /payment-handler/tokenize - Tokenize payment credentials
 * - POST /payment-handler/detokenize - Detokenize (authorized businesses only)
 * - GET /payment-handler/info - Handler configuration info
 */
export async function paymentHandlerRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /payment-handler/tokenize
   * 
   * Tokenizes payment credentials bound to a specific checkout.
   */
  app.post<{
    Body: TokenizeRequestInput;
  }>(
    '/payment-handler/tokenize',
    {
      schema: {
        description: 'Tokenize payment credentials',
        tags: ['Payment Handler'],
        body: {
          type: 'object',
          required: ['sourceCredential', 'binding'],
          properties: {
            sourceCredential: {
              type: 'object',
              description: 'Payment credentials to tokenize',
            },
            binding: {
              type: 'object',
              required: ['checkoutId', 'businessIdentity'],
              properties: {
                checkoutId: { type: 'string' },
                businessIdentity: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['wix_merchant_id'] },
                    value: { type: 'string' },
                  },
                },
              },
            },
            metadata: { type: 'object' },
          },
        },
        response: {
          200: {
            description: 'Tokenization successful',
            type: 'object',
            properties: {
              token: { type: 'string' },
              expiresAt: { type: 'string', format: 'date-time' },
              instrument: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['card', 'wallet'] },
                  brand: { type: 'string' },
                  lastDigits: { type: 'string' },
                  expiryMonth: { type: 'string' },
                  expiryYear: { type: 'string' },
                },
              },
            },
          },
          400: { description: 'Invalid request' },
          422: { description: 'Validation error' },
        },
      },
    },
    async (request: FastifyRequest<{ Body: TokenizeRequestInput }>, reply: FastifyReply) => {
      // Validate request body
      const parseResult = TokenizeRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        const errors = parseResult.error.errors.map((e) => ({
          field: e.path.join('.'),
          code: 'INVALID_FIELD',
          message: e.message,
        }));

        return reply.status(400).send({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid tokenize request',
            details: errors,
          },
        });
      }

      const handler = getHandler();

      try {
        const result = await handler.tokenize(parseResult.data);
        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof UCPException) {
          return reply.status(error.statusCode).send(error.toResponse());
        }
        throw error;
      }
    }
  );

  /**
   * POST /payment-handler/detokenize
   * 
   * Detokenizes a payment token (for authorized businesses/PSPs only).
   * Token is invalidated after single use.
   */
  app.post<{
    Body: DetokenizeRequestInput;
  }>(
    '/payment-handler/detokenize',
    {
      schema: {
        description: 'Detokenize a payment token',
        tags: ['Payment Handler'],
        body: {
          type: 'object',
          required: ['token', 'binding'],
          properties: {
            token: { type: 'string' },
            binding: {
              type: 'object',
              required: ['checkoutId', 'businessIdentity'],
              properties: {
                checkoutId: { type: 'string' },
                businessIdentity: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['wix_merchant_id'] },
                    value: { type: 'string' },
                  },
                },
              },
            },
            delegatedTo: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['psp'] },
                identity: { type: 'string' },
              },
            },
          },
        },
        response: {
          200: {
            description: 'Detokenization successful',
            type: 'object',
            properties: {
              credential: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['network_token', 'pan'] },
                  networkToken: { type: 'string' },
                  cryptogram: { type: 'string' },
                  eci: { type: 'string' },
                  pan: { type: 'string' },
                  expiryMonth: { type: 'string' },
                  expiryYear: { type: 'string' },
                },
              },
              invalidated: { type: 'boolean' },
            },
          },
          400: { description: 'Invalid request' },
          403: { description: 'Binding mismatch' },
          404: { description: 'Token not found' },
          410: { description: 'Token expired or already used' },
        },
      },
    },
    async (request: FastifyRequest<{ Body: DetokenizeRequestInput }>, reply: FastifyReply) => {
      // Validate request body
      const parseResult = DetokenizeRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        const errors = parseResult.error.errors.map((e) => ({
          field: e.path.join('.'),
          code: 'INVALID_FIELD',
          message: e.message,
        }));

        return reply.status(400).send({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid detokenize request',
            details: errors,
          },
        });
      }

      const handler = getHandler();

      try {
        const result = await handler.detokenize(parseResult.data);
        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof UCPException) {
          return reply.status(error.statusCode).send(error.toResponse());
        }
        throw error;
      }
    }
  );

  /**
   * GET /payment-handler/info
   * 
   * Returns handler configuration and capabilities.
   */
  app.get(
    '/payment-handler/info',
    {
      schema: {
        description: 'Get payment handler information',
        tags: ['Payment Handler'],
        response: {
          200: {
            description: 'Handler information',
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              version: { type: 'string' },
              spec: { type: 'string' },
              config: { type: 'object' },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const handler = getHandler();
      const declaration = handler.getHandlerDeclaration();
      return reply.status(200).send(declaration);
    }
  );
}

export default paymentHandlerRoutes;
