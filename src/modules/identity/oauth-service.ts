/**
 * OAuth Service
 * 
 * Core OAuth 2.0 implementation with PKCE support.
 * See: .cursor/rules/modules/identity.mdc
 */

import { createHash } from 'crypto';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { getRedis, setWithTTL, getJSON, deleteKey } from '../../lib/redis.js';
import { env } from '../../config/env.js';
import { TokenManager, getTokenManager } from './token-manager.js';
import type {
  AuthorizeParams,
  TokenRequest,
  TokenResponse,
  UserInfo,
  ValidationResult,
  OAuthClient,
  ConsentRecord,
  TokenClaims,
  VALID_SCOPES,
} from './types.js';
import {
  OAUTH_SCOPES,
  OAUTH_ERRORS,
  VALID_SCOPES as ALL_SCOPES,
} from './types.js';

// ─────────────────────────────────────────────────────────────
// Redis Keys
// ─────────────────────────────────────────────────────────────

const REDIS_PREFIX = {
  CONSENT: 'oauth:consent:',
  CLIENT: 'oauth:client:',
};

function consentKey(memberId: string, clientId: string): string {
  return `${REDIS_PREFIX.CONSENT}${memberId}:${clientId}`;
}

function clientKey(clientId: string): string {
  return `${REDIS_PREFIX.CLIENT}${clientId}`;
}

// ─────────────────────────────────────────────────────────────
// OAuth Service Class
// ─────────────────────────────────────────────────────────────

/**
 * OAuth 2.0 Service
 */
export class OAuthService {
  private tokenManager: TokenManager;

  constructor(tokenManager?: TokenManager) {
    this.tokenManager = tokenManager ?? getTokenManager();
  }

  // ─────────────────────────────────────────────────────────────
  // Authorization
  // ─────────────────────────────────────────────────────────────

  /**
   * Validate an authorization request
   */
  async validateAuthRequest(params: AuthorizeParams): Promise<ValidationResult> {
    // Check response type
    if (params.response_type !== 'code') {
      return {
        valid: false,
        error: OAUTH_ERRORS.UNSUPPORTED_RESPONSE_TYPE,
        errorDescription: 'Only "code" response type is supported',
      };
    }

    // Validate client
    const client = await this.getClient(params.client_id);
    if (!client) {
      return {
        valid: false,
        error: OAUTH_ERRORS.UNAUTHORIZED_CLIENT,
        errorDescription: 'Unknown client',
      };
    }

    // Validate redirect URI
    if (!client.redirectUris.includes(params.redirect_uri)) {
      return {
        valid: false,
        error: OAUTH_ERRORS.INVALID_REQUEST,
        errorDescription: 'Invalid redirect URI',
      };
    }

    // Validate scopes
    const requestedScopes = params.scope.split(' ').filter(Boolean);
    const invalidScopes = requestedScopes.filter(
      (s) => !ALL_SCOPES.includes(s as typeof ALL_SCOPES[number])
    );
    if (invalidScopes.length > 0) {
      return {
        valid: false,
        error: OAUTH_ERRORS.INVALID_SCOPE,
        errorDescription: `Invalid scopes: ${invalidScopes.join(', ')}`,
      };
    }

    // Check if scopes are allowed for this client
    const disallowedScopes = requestedScopes.filter(
      (s) => !client.allowedScopes.includes(s)
    );
    if (disallowedScopes.length > 0) {
      return {
        valid: false,
        error: OAUTH_ERRORS.INVALID_SCOPE,
        errorDescription: `Scopes not allowed for this client: ${disallowedScopes.join(', ')}`,
      };
    }

    // PKCE validation for public clients
    if (client.isPublic) {
      if (!params.code_challenge) {
        return {
          valid: false,
          error: OAUTH_ERRORS.INVALID_REQUEST,
          errorDescription: 'PKCE code_challenge required for public clients',
        };
      }
      if (params.code_challenge_method !== 'S256') {
        return {
          valid: false,
          error: OAUTH_ERRORS.INVALID_REQUEST,
          errorDescription: 'Only S256 code_challenge_method is supported',
        };
      }
    }

    // Validate state
    if (!params.state || params.state.length < 8) {
      return {
        valid: false,
        error: OAUTH_ERRORS.INVALID_REQUEST,
        errorDescription: 'State parameter must be at least 8 characters',
      };
    }

    return { valid: true };
  }

  /**
   * Generate authorization URL for redirects
   */
  generateAuthorizationUrl(
    baseUrl: string,
    params: AuthorizeParams,
    code: string
  ): string {
    const url = new URL(params.redirect_uri);
    url.searchParams.set('code', code);
    url.searchParams.set('state', params.state);
    return url.toString();
  }

  /**
   * Generate error redirect URL
   */
  generateErrorUrl(
    redirectUri: string,
    state: string,
    error: string,
    errorDescription?: string
  ): string {
    const url = new URL(redirectUri);
    url.searchParams.set('error', error);
    if (errorDescription) {
      url.searchParams.set('error_description', errorDescription);
    }
    url.searchParams.set('state', state);
    return url.toString();
  }

  /**
   * Process authorization and generate code
   */
  async processAuthorization(
    params: AuthorizeParams,
    memberId: string
  ): Promise<string> {
    const scopes = params.scope.split(' ').filter(Boolean);

    const code = await this.tokenManager.generateAuthCode({
      clientId: params.client_id,
      memberId,
      redirectUri: params.redirect_uri,
      scope: scopes,
      codeChallenge: params.code_challenge,
      codeChallengeMethod: params.code_challenge_method,
    });

    // Record consent
    await this.recordConsent({
      memberId,
      platformId: params.client_id,
      scope: scopes,
    });

    logger.info(
      { clientId: params.client_id, memberId, scopes },
      'Authorization code issued'
    );

    return code;
  }

  // ─────────────────────────────────────────────────────────────
  // Token Exchange
  // ─────────────────────────────────────────────────────────────

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(request: TokenRequest): Promise<TokenResponse> {
    if (request.grant_type !== 'authorization_code') {
      throw new OAuthError(
        OAUTH_ERRORS.INVALID_REQUEST,
        'Expected authorization_code grant type'
      );
    }

    if (!request.code) {
      throw new OAuthError(
        OAUTH_ERRORS.INVALID_REQUEST,
        'Authorization code is required'
      );
    }

    if (!request.redirect_uri) {
      throw new OAuthError(
        OAUTH_ERRORS.INVALID_REQUEST,
        'Redirect URI is required'
      );
    }

    const authCode = await this.tokenManager.validateAuthCode(
      request.code,
      request.client_id,
      request.redirect_uri,
      request.code_verifier
    );

    if (!authCode) {
      throw new OAuthError(
        OAUTH_ERRORS.INVALID_GRANT,
        'Invalid or expired authorization code'
      );
    }

    const response = await this.tokenManager.generateTokenResponse({
      memberId: authCode.memberId,
      clientId: request.client_id,
      platformId: request.client_id,
      scope: authCode.scope,
    });

    logger.info(
      { clientId: request.client_id, memberId: authCode.memberId },
      'Tokens issued via authorization code'
    );

    return response;
  }

  /**
   * Refresh access token
   */
  async refreshTokens(request: TokenRequest): Promise<TokenResponse> {
    if (request.grant_type !== 'refresh_token') {
      throw new OAuthError(
        OAUTH_ERRORS.INVALID_REQUEST,
        'Expected refresh_token grant type'
      );
    }

    if (!request.refresh_token) {
      throw new OAuthError(
        OAUTH_ERRORS.INVALID_REQUEST,
        'Refresh token is required'
      );
    }

    const tokenData = await this.tokenManager.validateRefreshToken(
      request.refresh_token
    );

    if (!tokenData) {
      throw new OAuthError(
        OAUTH_ERRORS.INVALID_GRANT,
        'Invalid or expired refresh token'
      );
    }

    // Verify client matches
    if (tokenData.clientId !== request.client_id) {
      throw new OAuthError(
        OAUTH_ERRORS.INVALID_CLIENT,
        'Client ID mismatch'
      );
    }

    const response = await this.tokenManager.generateTokenResponse({
      memberId: tokenData.memberId,
      clientId: tokenData.clientId,
      platformId: tokenData.platformId,
      scope: tokenData.scope,
    });

    logger.info(
      { clientId: request.client_id, memberId: tokenData.memberId },
      'Tokens refreshed'
    );

    return response;
  }

  // ─────────────────────────────────────────────────────────────
  // Token Validation
  // ─────────────────────────────────────────────────────────────

  /**
   * Validate access token and return claims
   */
  async validateToken(accessToken: string): Promise<TokenClaims | null> {
    return this.tokenManager.validateAccessToken(accessToken);
  }

  /**
   * Revoke token
   */
  async revokeToken(token: string, tokenTypeHint?: string): Promise<void> {
    // Try to determine token type
    if (tokenTypeHint === 'refresh_token' || token.startsWith('rt_')) {
      await this.tokenManager.revokeRefreshToken(token);
    } else {
      // Assume access token
      await this.tokenManager.revokeAccessToken(token);
    }

    logger.info('Token revoked');
  }

  // ─────────────────────────────────────────────────────────────
  // Client Management
  // ─────────────────────────────────────────────────────────────

  /**
   * Get OAuth client by ID
   */
  async getClient(clientId: string): Promise<OAuthClient | null> {
    // Try cache first
    const cached = await getJSON<OAuthClient>(clientKey(clientId));
    if (cached) {
      return cached;
    }

    // Check database
    try {
      const dbClient = await prisma.apiClient.findUnique({
        where: { id: clientId },
      });

      if (!dbClient) {
        // Return a default client for development
        if (process.env.NODE_ENV !== 'production') {
          return this.getDefaultDevClient(clientId);
        }
        return null;
      }

      const client: OAuthClient = {
        clientId: dbClient.clientId,
        clientSecretHash: dbClient.secretHash ?? undefined,
        name: dbClient.name,
        redirectUris: dbClient.redirectUris as string[],
        allowedScopes: dbClient.allowedScopes as string[],
        isPublic: !dbClient.secretHash, // Public if no secret
        createdAt: dbClient.createdAt.toISOString(),
      };

      // Cache for 5 minutes
      await setWithTTL(clientKey(clientId), client, 300);

      return client;
    } catch (error) {
      logger.error({ error }, 'Failed to fetch OAuth client');
      
      // Return default client in development
      if (process.env.NODE_ENV !== 'production') {
        return this.getDefaultDevClient(clientId);
      }
      return null;
    }
  }

  /**
   * Get default development client
   */
  private getDefaultDevClient(clientId: string): OAuthClient {
    return {
      clientId,
      name: 'Development Client',
      redirectUris: [
        'http://localhost:3000/callback',
        'http://localhost:8080/callback',
        'https://oauth.pstmn.io/v1/callback',
      ],
      allowedScopes: ALL_SCOPES as unknown as string[],
      isPublic: true,
      createdAt: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Consent Management
  // ─────────────────────────────────────────────────────────────

  /**
   * Check if consent exists
   */
  async hasConsent(
    memberId: string,
    clientId: string,
    requestedScopes: string[]
  ): Promise<boolean> {
    const consent = await getJSON<ConsentRecord>(consentKey(memberId, clientId));
    if (!consent) {
      return false;
    }

    // Check if all requested scopes are covered
    return requestedScopes.every((s) => consent.scope.includes(s));
  }

  /**
   * Record consent
   */
  async recordConsent(params: {
    memberId: string;
    platformId: string;
    scope: string[];
  }): Promise<void> {
    const consent: ConsentRecord = {
      id: `consent_${params.memberId}_${params.platformId}`,
      memberId: params.memberId,
      platformId: params.platformId,
      scope: params.scope,
      grantedAt: new Date().toISOString(),
    };

    // Store in Redis (30 day expiry)
    await setWithTTL(
      consentKey(params.memberId, params.platformId),
      consent,
      30 * 24 * 60 * 60
    );

    // Also store in database for persistence
    try {
      await prisma.oAuthConsent.upsert({
        where: {
          memberId_platformId: {
            memberId: params.memberId,
            platformId: params.platformId,
          },
        },
        update: {
          scope: params.scope,
          grantedAt: new Date(),
        },
        create: {
          memberId: params.memberId,
          platformId: params.platformId,
          scope: params.scope,
          grantedAt: new Date(),
        },
      });
    } catch (error) {
      logger.warn({ error }, 'Failed to persist consent to database');
    }

    logger.debug(
      { memberId: params.memberId, platformId: params.platformId },
      'Consent recorded'
    );
  }

  /**
   * Revoke consent
   */
  async revokeConsent(memberId: string, clientId: string): Promise<void> {
    await deleteKey(consentKey(memberId, clientId));

    try {
      await prisma.oAuthConsent.deleteMany({
        where: { memberId, platformId: clientId },
      });
    } catch (error) {
      logger.warn({ error }, 'Failed to delete consent from database');
    }

    logger.info({ memberId, clientId }, 'Consent revoked');
  }

  /**
   * Filter scopes to allowed ones
   */
  filterScopes(requested: string[], allowed: string[]): string[] {
    return requested.filter((s) => allowed.includes(s));
  }
}

/**
 * OAuth error class
 */
export class OAuthError extends Error {
  public readonly errorCode: string;
  public readonly errorDescription: string;

  constructor(errorCode: string, errorDescription: string) {
    super(errorDescription);
    this.name = 'OAuthError';
    this.errorCode = errorCode;
    this.errorDescription = errorDescription;
  }
}

/**
 * Create OAuth service instance
 */
export function createOAuthService(tokenManager?: TokenManager): OAuthService {
  return new OAuthService(tokenManager);
}

/**
 * Default service instance
 */
let defaultService: OAuthService | null = null;

/**
 * Get default OAuth service
 */
export function getOAuthService(): OAuthService {
  if (!defaultService) {
    defaultService = createOAuthService();
  }
  return defaultService;
}
