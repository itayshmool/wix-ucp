/**
 * Discovery Routes
 * 
 * Fastify routes for UCP profile discovery.
 * See: .cursor/rules/modules/discovery.mdc
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { logger } from '../../lib/logger.js';
import { getRedis, getJSON, setWithTTL } from '../../lib/redis.js';
import { env } from '../../config/env.js';
import { getCapabilityRegistry, registerDefaultCapabilities } from './capability-registry.js';
import { getHandlerRegistry, registerWixPaymentsHandler } from './handler-registry.js';
import { createProfileBuilder, applyProfileContext } from './profile-builder.js';
import { negotiate, buildNegotiateResponse, validateAgentProfile } from './negotiation.js';
import type { UCPProfile, NegotiateRequest, ProfileContext } from './types.js';
import { PROFILE_CACHE_TTL } from './types.js';

/**
 * Zod schema for negotiate request
 */
const NegotiateRequestSchema = z.object({
  agentProfile: z.object({
    capabilities: z.array(z.string()),
    handlers: z.array(z.string()),
    extensions: z.array(z.string()),
  }),
});

/**
 * Redis key for profile cache
 */
function getProfileCacheKey(siteId: string): string {
  return `profile:${siteId}`;
}

/**
 * Build the UCP profile for the current site
 */
async function buildProfile(context?: ProfileContext): Promise<UCPProfile> {
  const siteId = env.WIX_SITE_ID ?? 'default_site';
  const baseUrl = env.UCP_BASE_URL ?? 'http://localhost:3000';

  // Ensure registries are initialized
  const capabilityRegistry = getCapabilityRegistry();
  const handlerRegistry = getHandlerRegistry();

  if (capabilityRegistry.size === 0) {
    registerDefaultCapabilities(capabilityRegistry);
  }

  if (handlerRegistry.size === 0) {
    const merchantId = env.WIX_ACCOUNT_ID ?? 'default_merchant';
    registerWixPaymentsHandler(handlerRegistry, merchantId);
  }

  // Build profile
  const profile = createProfileBuilder()
    .setBusinessInfo({
      id: siteId,
      name: process.env.BUSINESS_NAME ?? 'Wix Store',
      description: process.env.BUSINESS_DESCRIPTION,
      url: baseUrl,
      currency: 'USD',
      supportedCurrencies: ['USD', 'EUR', 'GBP'],
      contact: {
        email: process.env.BUSINESS_EMAIL,
        phone: process.env.BUSINESS_PHONE,
      },
    })
    .setTransports({
      rest: { 
        endpoint: `${baseUrl}/ucp/v1`,
        schema: 'https://ucp.dev/services/shopping/rest.openapi.json',
      },
      mcp: { 
        endpoint: `${baseUrl}/mcp`,
        schema: 'https://ucp.dev/services/shopping/mcp.openrpc.json',
      },
    })
    .addCapabilities(capabilityRegistry.listPublic())
    .addPaymentHandlers(handlerRegistry.list())
    .build();

  // Apply dynamic context if provided
  if (context) {
    return applyProfileContext(profile, context);
  }

  return profile;
}

/**
 * Get profile with caching
 */
async function getProfileCached(context?: ProfileContext): Promise<UCPProfile> {
  const siteId = env.WIX_SITE_ID ?? 'default_site';
  const cacheKey = getProfileCacheKey(siteId);

  // Don't cache dynamic profiles
  if (context) {
    return buildProfile(context);
  }

  // Try cache first
  try {
    const cached = await getJSON<UCPProfile>(cacheKey);
    if (cached) {
      logger.debug({ siteId }, 'Profile cache hit');
      return cached;
    }
  } catch (error) {
    logger.warn({ error }, 'Profile cache read failed');
  }

  // Build and cache
  const profile = await buildProfile();

  try {
    await setWithTTL(cacheKey, profile, PROFILE_CACHE_TTL);
    logger.debug({ siteId, ttl: PROFILE_CACHE_TTL }, 'Profile cached');
  } catch (error) {
    logger.warn({ error }, 'Profile cache write failed');
  }

  return profile;
}

/**
 * Register discovery routes
 */
export async function discoveryRoutes(fastify: FastifyInstance): Promise<void> {
  // ─────────────────────────────────────────────────────────────
  // GET /.well-known/ucp - Get UCP profile
  // ─────────────────────────────────────────────────────────────

  fastify.get<{
    Querystring: { currency?: string; amount?: string; country?: string };
    Reply: UCPProfile;
  }>(
    '/.well-known/ucp',
    {
      schema: {
        description: 'Get UCP business profile',
        tags: ['Discovery'],
        querystring: {
          type: 'object',
          properties: {
            currency: { type: 'string', description: 'Filter by currency' },
            amount: { type: 'string', description: 'Cart amount for dynamic filtering' },
            country: { type: 'string', description: 'Buyer country for filtering' },
          },
        },
        response: {
          200: {
            description: 'UCP profile',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      const { currency, amount, country } = request.query;

      // Build context if query params provided
      let context: ProfileContext | undefined;
      if (currency || amount || country) {
        context = {
          currency: currency?.toUpperCase(),
          cartAmount: amount ? parseInt(amount, 10) : undefined,
          buyerCountry: country?.toUpperCase(),
        };
      }

      logger.debug({ context }, 'Fetching UCP profile');

      const profile = await getProfileCached(context);

      // Set cache headers for static profiles
      if (!context) {
        reply.header('Cache-Control', `public, max-age=${PROFILE_CACHE_TTL}`);
      } else {
        reply.header('Cache-Control', 'no-cache');
      }

      return reply.send(profile);
    }
  );

  // ─────────────────────────────────────────────────────────────
  // POST /.well-known/ucp/negotiate - Negotiate capabilities
  // ─────────────────────────────────────────────────────────────

  fastify.post<{
    Body: NegotiateRequest;
  }>(
    '/.well-known/ucp/negotiate',
    {
      schema: {
        description: 'Negotiate capabilities with an agent',
        tags: ['Discovery'],
        body: {
          type: 'object',
          required: ['agentProfile'],
          properties: {
            agentProfile: {
              type: 'object',
              required: ['capabilities', 'handlers', 'extensions'],
              properties: {
                capabilities: { type: 'array', items: { type: 'string' } },
                handlers: { type: 'array', items: { type: 'string' } },
                extensions: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
        response: {
          200: {
            description: 'Negotiation result',
            type: 'object',
          },
          400: {
            description: 'Invalid agent profile',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      // Validate request
      const parseResult = NegotiateRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Invalid agent profile format',
          details: parseResult.error.errors,
        });
      }

      const { agentProfile } = parseResult.data;

      // Validate agent profile
      const validationErrors = validateAgentProfile(agentProfile);
      if (validationErrors.length > 0) {
        return reply.status(400).send({
          error: 'INVALID_AGENT_PROFILE',
          message: 'Agent profile validation failed',
          details: validationErrors,
        });
      }

      logger.info(
        {
          agentCapabilities: agentProfile.capabilities.length,
          agentHandlers: agentProfile.handlers.length,
          agentExtensions: agentProfile.extensions.length,
        },
        'Processing negotiation request'
      );

      // Get business profile
      const businessProfile = await getProfileCached();

      // Perform negotiation
      const result = negotiate(businessProfile, agentProfile);
      const response = buildNegotiateResponse(result);

      // No caching for negotiation results
      reply.header('Cache-Control', 'no-store');

      return reply.send(response);
    }
  );

  // ─────────────────────────────────────────────────────────────
  // POST /.well-known/ucp/invalidate-cache - Invalidate profile cache
  // ─────────────────────────────────────────────────────────────

  fastify.post(
    '/.well-known/ucp/invalidate-cache',
    {
      schema: {
        description: 'Invalidate the cached UCP profile (admin only)',
        tags: ['Discovery'],
        response: {
          200: {
            description: 'Cache invalidated',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          500: {
            description: 'Cache invalidation failed',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const siteId = env.WIX_SITE_ID ?? 'default_site';
      const cacheKey = getProfileCacheKey(siteId);

      try {
        const redis = getRedis();
        await redis.del(cacheKey);
        
        logger.info({ siteId }, 'Profile cache invalidated');

        return reply.send({
          success: true,
          message: 'Profile cache invalidated',
        });
      } catch (error) {
        logger.error({ error }, 'Failed to invalidate cache');
        return reply.status(500).send({
          success: false,
          message: 'Failed to invalidate cache',
        });
      }
    }
  );

  logger.info('Discovery routes registered');
}
