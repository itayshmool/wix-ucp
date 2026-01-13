/**
 * Identity Routes
 * 
 * OAuth 2.0 endpoints for identity linking.
 * See: .cursor/rules/modules/identity.mdc
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { logger } from '../../lib/logger.js';
import { getOAuthService, OAuthError } from './oauth-service.js';
import { getTokenManager } from './token-manager.js';
import {
  mapMemberToUserInfo,
  addLoyaltyToUserInfo,
  getMemberData,
} from './member-mapper.js';
import type {
  AuthorizeParams,
  TokenRequest,
  TokenResponse,
  UserInfo,
  RevokeRequest,
} from './types.js';
import { OAUTH_ERRORS, VALID_SCOPES } from './types.js';

// ─────────────────────────────────────────────────────────────
// Zod Schemas
// ─────────────────────────────────────────────────────────────

const AuthorizeQuerySchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  scope: z.string().min(1),
  state: z.string().min(8),
  code_challenge: z.string().optional(),
  code_challenge_method: z.literal('S256').optional(),
});

const TokenRequestSchema = z.object({
  grant_type: z.enum(['authorization_code', 'refresh_token']),
  code: z.string().optional(),
  refresh_token: z.string().optional(),
  client_id: z.string().min(1),
  client_secret: z.string().optional(),
  redirect_uri: z.string().optional(),
  code_verifier: z.string().optional(),
});

const RevokeRequestSchema = z.object({
  token: z.string().min(1),
  token_type_hint: z.enum(['access_token', 'refresh_token']).optional(),
});

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Build OAuth error response
 */
function buildOAuthError(error: string, description: string) {
  return {
    error,
    error_description: description,
  };
}

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

/**
 * Register identity routes
 */
export async function identityRoutes(fastify: FastifyInstance): Promise<void> {
  const oauthService = getOAuthService();
  const tokenManager = getTokenManager();

  // ─────────────────────────────────────────────────────────────
  // GET /identity/authorize - Authorization endpoint
  // ─────────────────────────────────────────────────────────────

  fastify.get<{
    Querystring: AuthorizeParams;
  }>(
    '/identity/authorize',
    {
      schema: {
        description: 'OAuth 2.0 authorization endpoint',
        tags: ['Identity'],
        querystring: {
          type: 'object',
          required: ['response_type', 'client_id', 'redirect_uri', 'scope', 'state'],
          properties: {
            response_type: { type: 'string', enum: ['code'] },
            client_id: { type: 'string' },
            redirect_uri: { type: 'string', format: 'uri' },
            scope: { type: 'string' },
            state: { type: 'string', minLength: 8 },
            code_challenge: { type: 'string' },
            code_challenge_method: { type: 'string', enum: ['S256'] },
          },
        },
      },
    },
    async (request, reply) => {
      const parseResult = AuthorizeQuerySchema.safeParse(request.query);
      
      if (!parseResult.success) {
        // Cannot redirect - return error JSON
        return reply.status(400).send(
          buildOAuthError(
            OAUTH_ERRORS.INVALID_REQUEST,
            'Invalid authorization request'
          )
        );
      }

      const params = parseResult.data;

      // Validate authorization request
      const validation = await oauthService.validateAuthRequest(params);
      if (!validation.valid) {
        // Redirect with error if possible
        if (params.redirect_uri && params.state) {
          const errorUrl = oauthService.generateErrorUrl(
            params.redirect_uri,
            params.state,
            validation.error!,
            validation.errorDescription
          );
          return reply.redirect(errorUrl);
        }
        return reply.status(400).send(
          buildOAuthError(validation.error!, validation.errorDescription!)
        );
      }

      // In a real implementation, this would:
      // 1. Check if user is logged in (redirect to login if not)
      // 2. Check for existing consent
      // 3. Show consent screen if needed
      // 4. Generate auth code after consent

      // For development/testing, auto-approve with mock member
      const mockMemberId = `member_${params.client_id}`;
      
      const code = await oauthService.processAuthorization(
        params,
        mockMemberId
      );

      const redirectUrl = oauthService.generateAuthorizationUrl(
        '', // Not used in this implementation
        params,
        code
      );

      logger.info(
        { clientId: params.client_id, memberId: mockMemberId },
        'Authorization completed, redirecting'
      );

      return reply.redirect(redirectUrl);
    }
  );

  // ─────────────────────────────────────────────────────────────
  // POST /identity/token - Token endpoint
  // ─────────────────────────────────────────────────────────────

  fastify.post<{
    Body: TokenRequest;
    Reply: TokenResponse | { error: string; error_description: string };
  }>(
    '/identity/token',
    {
      schema: {
        description: 'OAuth 2.0 token endpoint',
        tags: ['Identity'],
        body: {
          type: 'object',
          required: ['grant_type', 'client_id'],
          properties: {
            grant_type: { type: 'string', enum: ['authorization_code', 'refresh_token'] },
            code: { type: 'string' },
            refresh_token: { type: 'string' },
            client_id: { type: 'string' },
            client_secret: { type: 'string' },
            redirect_uri: { type: 'string' },
            code_verifier: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Token response',
            type: 'object',
            properties: {
              access_token: { type: 'string' },
              token_type: { type: 'string' },
              expires_in: { type: 'number' },
              refresh_token: { type: 'string' },
              scope: { type: 'string' },
            },
          },
          400: {
            description: 'OAuth error',
            type: 'object',
            properties: {
              error: { type: 'string' },
              error_description: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const parseResult = TokenRequestSchema.safeParse(request.body);
      
      if (!parseResult.success) {
        return reply.status(400).send(
          buildOAuthError(
            OAUTH_ERRORS.INVALID_REQUEST,
            'Invalid token request'
          )
        );
      }

      const tokenRequest = parseResult.data;

      try {
        let response: TokenResponse;

        if (tokenRequest.grant_type === 'authorization_code') {
          response = await oauthService.exchangeCode(tokenRequest);
        } else {
          response = await oauthService.refreshTokens(tokenRequest);
        }

        // Set cache headers
        reply.header('Cache-Control', 'no-store');
        reply.header('Pragma', 'no-cache');

        return reply.send(response);
      } catch (error) {
        if (error instanceof OAuthError) {
          return reply.status(400).send(
            buildOAuthError(error.errorCode, error.errorDescription)
          );
        }

        logger.error({ error }, 'Token endpoint error');
        return reply.status(500).send(
          buildOAuthError(OAUTH_ERRORS.SERVER_ERROR, 'Internal server error')
        );
      }
    }
  );

  // ─────────────────────────────────────────────────────────────
  // GET /identity/userinfo - UserInfo endpoint
  // ─────────────────────────────────────────────────────────────

  fastify.get<{
    Reply: UserInfo | { error: string; error_description: string };
  }>(
    '/identity/userinfo',
    {
      schema: {
        description: 'OpenID Connect UserInfo endpoint',
        tags: ['Identity'],
        headers: {
          type: 'object',
          properties: {
            authorization: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'User info',
            type: 'object',
          },
          401: {
            description: 'Unauthorized',
            type: 'object',
            properties: {
              error: { type: 'string' },
              error_description: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const authHeader = request.headers.authorization;
      const accessToken = extractBearerToken(authHeader);

      if (!accessToken) {
        reply.header('WWW-Authenticate', 'Bearer');
        return reply.status(401).send(
          buildOAuthError(
            OAUTH_ERRORS.INVALID_TOKEN,
            'Missing or invalid access token'
          )
        );
      }

      const claims = await tokenManager.validateAccessToken(accessToken);
      if (!claims) {
        reply.header('WWW-Authenticate', 'Bearer error="invalid_token"');
        return reply.status(401).send(
          buildOAuthError(
            OAUTH_ERRORS.INVALID_TOKEN,
            'Invalid or expired access token'
          )
        );
      }

      const scope = claims.scope.split(' ');

      // Get member data
      const { member, loyaltyInfo } = await getMemberData(claims.sub, scope);

      // Map to UserInfo
      let userInfo = mapMemberToUserInfo(member, scope);
      userInfo = addLoyaltyToUserInfo(userInfo, loyaltyInfo ?? null);

      logger.debug(
        { memberId: claims.sub, scopes: scope },
        'UserInfo retrieved'
      );

      return reply.send(userInfo);
    }
  );

  // ─────────────────────────────────────────────────────────────
  // POST /identity/revoke - Token revocation endpoint
  // ─────────────────────────────────────────────────────────────

  fastify.post<{
    Body: RevokeRequest;
  }>(
    '/identity/revoke',
    {
      schema: {
        description: 'OAuth 2.0 token revocation endpoint',
        tags: ['Identity'],
        body: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' },
            token_type_hint: { type: 'string', enum: ['access_token', 'refresh_token'] },
          },
        },
        response: {
          200: {
            description: 'Token revoked (always returns 200)',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      const parseResult = RevokeRequestSchema.safeParse(request.body);
      
      if (!parseResult.success) {
        // RFC 7009: Return 200 even for invalid requests
        return reply.send({});
      }

      const { token, token_type_hint } = parseResult.data;

      try {
        await oauthService.revokeToken(token, token_type_hint);
      } catch (error) {
        // RFC 7009: Return 200 even on errors
        logger.warn({ error }, 'Token revocation error');
      }

      // Always return 200 per RFC 7009
      return reply.send({});
    }
  );

  // ─────────────────────────────────────────────────────────────
  // GET /identity/.well-known/openid-configuration
  // ─────────────────────────────────────────────────────────────

  fastify.get(
    '/identity/.well-known/openid-configuration',
    {
      schema: {
        description: 'OpenID Connect Discovery',
        tags: ['Identity'],
        response: {
          200: {
            description: 'OpenID configuration',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      const baseUrl = process.env.UCP_BASE_URL ?? 'http://localhost:3000';

      const config = {
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/identity/authorize`,
        token_endpoint: `${baseUrl}/identity/token`,
        userinfo_endpoint: `${baseUrl}/identity/userinfo`,
        revocation_endpoint: `${baseUrl}/identity/revoke`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['HS256'],
        scopes_supported: VALID_SCOPES,
        token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
        code_challenge_methods_supported: ['S256'],
        claims_supported: [
          'sub',
          'email',
          'email_verified',
          'name',
          'given_name',
          'family_name',
          'picture',
          'locale',
          'ucp_member_id',
          'ucp_loyalty_tier',
          'ucp_loyalty_points',
          'ucp_saved_addresses',
        ],
      };

      reply.header('Cache-Control', 'public, max-age=86400');
      return reply.send(config);
    }
  );

  logger.info('Identity routes registered');
}
