/**
 * Token Manager
 * 
 * Manages JWT access tokens, refresh tokens, and authorization codes.
 * See: .cursor/rules/modules/identity.mdc
 */

import { randomUUID, createHash } from 'crypto';
import * as jose from 'jose';
import { logger } from '../../lib/logger.js';
import { getRedis, setWithTTL, getJSON, deleteKey } from '../../lib/redis.js';
import { env } from '../../config/env.js';
import type {
  TokenClaims,
  TokenResponse,
  AuthorizationCode,
  TOKEN_EXPIRY,
} from './types.js';
import { TOKEN_EXPIRY as EXPIRY } from './types.js';

// ─────────────────────────────────────────────────────────────
// Redis Key Helpers
// ─────────────────────────────────────────────────────────────

const REDIS_PREFIX = {
  AUTH_CODE: 'oauth:code:',
  REFRESH_TOKEN: 'oauth:refresh:',
  ACCESS_TOKEN_JTI: 'oauth:jti:',
};

function authCodeKey(code: string): string {
  return `${REDIS_PREFIX.AUTH_CODE}${code}`;
}

function refreshTokenKey(token: string): string {
  return `${REDIS_PREFIX.REFRESH_TOKEN}${hashToken(token)}`;
}

function jtiKey(jti: string): string {
  return `${REDIS_PREFIX.ACCESS_TOKEN_JTI}${jti}`;
}

/**
 * Hash a token for storage
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ─────────────────────────────────────────────────────────────
// JWT Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Get JWT secret as Uint8Array
 */
function getJwtSecret(): Uint8Array {
  const secret = env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Get issuer URL
 */
function getIssuer(): string {
  return env.UCP_BASE_URL ?? 'http://localhost:3000';
}

// ─────────────────────────────────────────────────────────────
// Token Manager Class
// ─────────────────────────────────────────────────────────────

/**
 * Token Manager
 * 
 * Handles creation, validation, and revocation of OAuth tokens.
 */
export class TokenManager {
  private jwtSecret: Uint8Array;
  private issuer: string;

  constructor() {
    this.jwtSecret = getJwtSecret();
    this.issuer = getIssuer();
  }

  // ─────────────────────────────────────────────────────────────
  // Authorization Code
  // ─────────────────────────────────────────────────────────────

  /**
   * Generate an authorization code
   */
  async generateAuthCode(params: {
    clientId: string;
    memberId: string;
    redirectUri: string;
    scope: string[];
    codeChallenge?: string;
    codeChallengeMethod?: 'S256';
  }): Promise<string> {
    const code = randomUUID();
    const expiresAt = new Date(Date.now() + EXPIRY.AUTH_CODE * 1000).toISOString();

    const authCode: AuthorizationCode = {
      code,
      clientId: params.clientId,
      memberId: params.memberId,
      redirectUri: params.redirectUri,
      scope: params.scope,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: params.codeChallengeMethod,
      expiresAt,
      used: false,
    };

    await setWithTTL(authCodeKey(code), authCode, EXPIRY.AUTH_CODE);

    logger.debug(
      { clientId: params.clientId, memberId: params.memberId },
      'Authorization code generated'
    );

    return code;
  }

  /**
   * Validate and consume an authorization code
   */
  async validateAuthCode(
    code: string,
    clientId: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<AuthorizationCode | null> {
    const authCode = await getJSON<AuthorizationCode>(authCodeKey(code));

    if (!authCode) {
      logger.warn({ code: code.slice(0, 8) }, 'Authorization code not found');
      return null;
    }

    // Check if already used
    if (authCode.used) {
      logger.warn({ code: code.slice(0, 8) }, 'Authorization code already used');
      await deleteKey(authCodeKey(code));
      return null;
    }

    // Check expiration
    if (new Date(authCode.expiresAt) < new Date()) {
      logger.warn({ code: code.slice(0, 8) }, 'Authorization code expired');
      await deleteKey(authCodeKey(code));
      return null;
    }

    // Validate client ID
    if (authCode.clientId !== clientId) {
      logger.warn(
        { expected: authCode.clientId, got: clientId },
        'Client ID mismatch'
      );
      return null;
    }

    // Validate redirect URI
    if (authCode.redirectUri !== redirectUri) {
      logger.warn(
        { expected: authCode.redirectUri, got: redirectUri },
        'Redirect URI mismatch'
      );
      return null;
    }

    // Validate PKCE if code challenge was set
    if (authCode.codeChallenge) {
      if (!codeVerifier) {
        logger.warn('PKCE required but code verifier not provided');
        return null;
      }

      const challenge = createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      if (challenge !== authCode.codeChallenge) {
        logger.warn('PKCE code verifier invalid');
        return null;
      }
    }

    // Mark as used and delete
    await deleteKey(authCodeKey(code));

    logger.debug(
      { clientId, memberId: authCode.memberId },
      'Authorization code validated'
    );

    return authCode;
  }

  // ─────────────────────────────────────────────────────────────
  // Access Token
  // ─────────────────────────────────────────────────────────────

  /**
   * Generate an access token
   */
  async generateAccessToken(params: {
    memberId: string;
    clientId: string;
    platformId: string;
    scope: string[];
  }): Promise<{ token: string; expiresIn: number }> {
    const jti = randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const exp = now + EXPIRY.ACCESS_TOKEN;

    const claims: TokenClaims = {
      sub: params.memberId,
      iss: this.issuer,
      aud: params.clientId,
      exp,
      iat: now,
      scope: params.scope.join(' '),
      platform_id: params.platformId,
      jti,
    };

    const token = await new jose.SignJWT(claims as unknown as jose.JWTPayload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .sign(this.jwtSecret);

    // Store JTI for revocation check
    await setWithTTL(jtiKey(jti), { valid: true }, EXPIRY.ACCESS_TOKEN);

    logger.debug(
      { memberId: params.memberId, clientId: params.clientId },
      'Access token generated'
    );

    return { token, expiresIn: EXPIRY.ACCESS_TOKEN };
  }

  /**
   * Validate an access token
   */
  async validateAccessToken(token: string): Promise<TokenClaims | null> {
    try {
      const { payload } = await jose.jwtVerify(token, this.jwtSecret, {
        issuer: this.issuer,
      });

      const claims = payload as unknown as TokenClaims;

      // Check if token was revoked (JTI blacklist)
      const jtiStatus = await getJSON<{ valid: boolean }>(jtiKey(claims.jti));
      if (!jtiStatus?.valid) {
        logger.debug({ jti: claims.jti }, 'Token revoked');
        return null;
      }

      return claims;
    } catch (error) {
      if (error instanceof jose.errors.JWTExpired) {
        logger.debug('Access token expired');
      } else if (error instanceof jose.errors.JWTInvalid) {
        logger.warn('Invalid access token');
      } else {
        logger.error({ error }, 'Access token validation error');
      }
      return null;
    }
  }

  /**
   * Revoke an access token
   */
  async revokeAccessToken(token: string): Promise<boolean> {
    const claims = await this.validateAccessToken(token);
    if (!claims) {
      return false;
    }

    // Mark JTI as invalid
    await setWithTTL(
      jtiKey(claims.jti),
      { valid: false },
      claims.exp - Math.floor(Date.now() / 1000)
    );

    logger.debug({ jti: claims.jti }, 'Access token revoked');
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // Refresh Token
  // ─────────────────────────────────────────────────────────────

  /**
   * Generate a refresh token
   */
  async generateRefreshToken(params: {
    memberId: string;
    clientId: string;
    platformId: string;
    scope: string[];
  }): Promise<string> {
    const token = `rt_${randomUUID().replace(/-/g, '')}`;
    const expiresAt = new Date(
      Date.now() + EXPIRY.REFRESH_TOKEN * 1000
    ).toISOString();

    const data = {
      memberId: params.memberId,
      clientId: params.clientId,
      platformId: params.platformId,
      scope: params.scope,
      expiresAt,
      used: false,
    };

    await setWithTTL(refreshTokenKey(token), data, EXPIRY.REFRESH_TOKEN);

    logger.debug(
      { memberId: params.memberId, clientId: params.clientId },
      'Refresh token generated'
    );

    return token;
  }

  /**
   * Validate and consume a refresh token (single-use rotation)
   */
  async validateRefreshToken(token: string): Promise<{
    memberId: string;
    clientId: string;
    platformId: string;
    scope: string[];
  } | null> {
    const key = refreshTokenKey(token);
    const data = await getJSON<{
      memberId: string;
      clientId: string;
      platformId: string;
      scope: string[];
      expiresAt: string;
      used: boolean;
    }>(key);

    if (!data) {
      logger.warn('Refresh token not found');
      return null;
    }

    // Check if already used (token rotation)
    if (data.used) {
      logger.warn('Refresh token already used - possible replay attack');
      await deleteKey(key);
      return null;
    }

    // Check expiration
    if (new Date(data.expiresAt) < new Date()) {
      logger.warn('Refresh token expired');
      await deleteKey(key);
      return null;
    }

    // Delete the token (single-use)
    await deleteKey(key);

    logger.debug(
      { memberId: data.memberId, clientId: data.clientId },
      'Refresh token validated'
    );

    return {
      memberId: data.memberId,
      clientId: data.clientId,
      platformId: data.platformId,
      scope: data.scope,
    };
  }

  /**
   * Revoke a refresh token
   */
  async revokeRefreshToken(token: string): Promise<boolean> {
    const deleted = await deleteKey(refreshTokenKey(token));
    if (deleted) {
      logger.debug('Refresh token revoked');
    }
    return deleted;
  }

  // ─────────────────────────────────────────────────────────────
  // Token Response Builder
  // ─────────────────────────────────────────────────────────────

  /**
   * Generate a complete token response
   */
  async generateTokenResponse(params: {
    memberId: string;
    clientId: string;
    platformId: string;
    scope: string[];
    includeRefreshToken?: boolean;
  }): Promise<TokenResponse> {
    const { token: accessToken, expiresIn } = await this.generateAccessToken({
      memberId: params.memberId,
      clientId: params.clientId,
      platformId: params.platformId,
      scope: params.scope,
    });

    const response: TokenResponse = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
      scope: params.scope.join(' '),
    };

    if (params.includeRefreshToken !== false) {
      response.refresh_token = await this.generateRefreshToken({
        memberId: params.memberId,
        clientId: params.clientId,
        platformId: params.platformId,
        scope: params.scope,
      });
    }

    return response;
  }
}

/**
 * Create a token manager instance
 */
export function createTokenManager(): TokenManager {
  return new TokenManager();
}

/**
 * Default token manager instance
 */
let defaultManager: TokenManager | null = null;

/**
 * Get default token manager
 */
export function getTokenManager(): TokenManager {
  if (!defaultManager) {
    defaultManager = createTokenManager();
  }
  return defaultManager;
}
