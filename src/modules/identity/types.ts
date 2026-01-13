/**
 * Identity Linking Types
 * 
 * Type definitions for OAuth 2.0 identity linking.
 * See: .cursor/rules/modules/identity.mdc
 */

import type { Address } from '../../core/types/ucp-common.js';

// ─────────────────────────────────────────────────────────────
// Capability Declaration
// ─────────────────────────────────────────────────────────────

/**
 * Identity capability info
 */
export const IDENTITY_CAPABILITY = {
  name: 'dev.ucp.shopping.identity',
  version: '2026-01-11',
  spec: 'https://ucp.dev/specification/identity',
} as const;

// ─────────────────────────────────────────────────────────────
// OAuth Scopes
// ─────────────────────────────────────────────────────────────

/**
 * Supported OAuth scopes
 */
export const OAUTH_SCOPES = {
  /** OpenID Connect authentication */
  OPENID: 'openid',
  /** Basic profile information */
  PROFILE: 'profile',
  /** Email address */
  EMAIL: 'email',
  /** Read order history */
  ORDERS_READ: 'orders:read',
  /** Read loyalty points */
  LOYALTY_READ: 'loyalty:read',
  /** Redeem loyalty points */
  LOYALTY_WRITE: 'loyalty:write',
  /** Read saved addresses */
  ADDRESSES_READ: 'addresses:read',
  /** Read saved payment methods */
  PAYMENT_METHODS_READ: 'payment_methods:read',
} as const;

export type OAuthScope = typeof OAUTH_SCOPES[keyof typeof OAUTH_SCOPES];

/**
 * All valid scopes as array
 */
export const VALID_SCOPES: OAuthScope[] = Object.values(OAUTH_SCOPES);

// ─────────────────────────────────────────────────────────────
// OAuth Request Types
// ─────────────────────────────────────────────────────────────

/**
 * Authorization request parameters
 */
export interface AuthorizeParams {
  /** Response type (must be 'code') */
  response_type: 'code';
  /** Platform's client ID */
  client_id: string;
  /** Platform's callback URL */
  redirect_uri: string;
  /** Space-separated scopes */
  scope: string;
  /** CSRF token */
  state: string;
  /** PKCE code challenge */
  code_challenge?: string;
  /** PKCE challenge method */
  code_challenge_method?: 'S256';
}

/**
 * Token request
 */
export interface TokenRequest {
  /** Grant type */
  grant_type: 'authorization_code' | 'refresh_token';
  /** Authorization code (for authorization_code grant) */
  code?: string;
  /** Refresh token (for refresh_token grant) */
  refresh_token?: string;
  /** Client ID */
  client_id: string;
  /** Client secret (for confidential clients) */
  client_secret?: string;
  /** Redirect URI (must match authorize request) */
  redirect_uri?: string;
  /** PKCE code verifier */
  code_verifier?: string;
}

/**
 * Token response
 */
export interface TokenResponse {
  /** Access token */
  access_token: string;
  /** Token type (always 'Bearer') */
  token_type: 'Bearer';
  /** Expiration time in seconds */
  expires_in: number;
  /** Refresh token (optional) */
  refresh_token?: string;
  /** Granted scopes */
  scope: string;
}

/**
 * Token revocation request
 */
export interface RevokeRequest {
  /** Token to revoke */
  token: string;
  /** Token type hint */
  token_type_hint?: 'access_token' | 'refresh_token';
}

// ─────────────────────────────────────────────────────────────
// User Info
// ─────────────────────────────────────────────────────────────

/**
 * OpenID Connect UserInfo response
 */
export interface UserInfo {
  /** Subject (member ID) */
  sub: string;
  /** Email address */
  email?: string;
  /** Email verified flag */
  email_verified?: boolean;
  /** Full name */
  name?: string;
  /** First name */
  given_name?: string;
  /** Family name */
  family_name?: string;
  /** Profile picture URL */
  picture?: string;
  /** Locale */
  locale?: string;

  // UCP-specific claims
  /** UCP member ID */
  ucp_member_id: string;
  /** Loyalty tier */
  ucp_loyalty_tier?: string;
  /** Loyalty points */
  ucp_loyalty_points?: number;
  /** Saved addresses */
  ucp_saved_addresses?: Address[];
}

// ─────────────────────────────────────────────────────────────
// Session Types
// ─────────────────────────────────────────────────────────────

/**
 * Identity session
 */
export interface IdentitySession {
  /** Session ID */
  id: string;
  /** Member ID (set after authentication) */
  memberId?: string;
  /** Platform/agent identifier */
  platformId: string;
  /** Granted scopes */
  scope: string[];
  /** Access token */
  accessToken: string;
  /** Refresh token */
  refreshToken?: string;
  /** Expiration timestamp */
  expiresAt: string;
  /** Creation timestamp */
  createdAt: string;
}

/**
 * Authorization code record
 */
export interface AuthorizationCode {
  /** The code itself */
  code: string;
  /** Client ID */
  clientId: string;
  /** Member ID */
  memberId: string;
  /** Redirect URI */
  redirectUri: string;
  /** Granted scopes */
  scope: string[];
  /** PKCE code challenge */
  codeChallenge?: string;
  /** Code challenge method */
  codeChallengeMethod?: 'S256';
  /** Expiration timestamp */
  expiresAt: string;
  /** Whether the code has been used */
  used: boolean;
}

// ─────────────────────────────────────────────────────────────
// Token Claims
// ─────────────────────────────────────────────────────────────

/**
 * JWT token claims
 */
export interface TokenClaims {
  /** Subject (member ID) */
  sub: string;
  /** Issuer */
  iss: string;
  /** Audience (client ID) */
  aud: string;
  /** Expiration time (Unix timestamp) */
  exp: number;
  /** Issued at (Unix timestamp) */
  iat: number;
  /** Scopes */
  scope: string;
  /** Platform ID */
  platform_id: string;
  /** Token ID (for revocation) */
  jti: string;
}

// ─────────────────────────────────────────────────────────────
// Consent Types
// ─────────────────────────────────────────────────────────────

/**
 * Consent record
 */
export interface ConsentRecord {
  /** Consent ID */
  id: string;
  /** Member ID */
  memberId: string;
  /** Platform/client ID */
  platformId: string;
  /** Granted scopes */
  scope: string[];
  /** When consent was granted */
  grantedAt: string;
  /** When consent expires (optional) */
  expiresAt?: string;
}

// ─────────────────────────────────────────────────────────────
// Member Profile Types
// ─────────────────────────────────────────────────────────────

/**
 * UCP Member profile
 */
export interface UCPMemberProfile {
  /** Member ID */
  id: string;
  /** Email */
  email: string;
  /** Name */
  name?: {
    first: string;
    last: string;
  };
  /** Phone */
  phone?: string;
  /** Saved addresses */
  addresses: Address[];
  /** Loyalty info */
  loyaltyInfo?: LoyaltyInfo;
  /** Saved payment methods */
  savedPaymentMethods?: SavedPaymentMethod[];
}

/**
 * Loyalty info
 */
export interface LoyaltyInfo {
  /** Program ID */
  programId: string;
  /** Current tier */
  tier: string;
  /** Current points */
  points: number;
  /** Lifetime points */
  lifetimePoints: number;
}

/**
 * Saved payment method
 */
export interface SavedPaymentMethod {
  /** Payment method ID */
  id: string;
  /** Type */
  type: 'card' | 'wallet';
  /** Card brand (if card) */
  brand?: string;
  /** Last 4 digits */
  lastDigits?: string;
  /** Expiry month */
  expiryMonth?: string;
  /** Expiry year */
  expiryYear?: string;
  /** Is default payment method */
  isDefault: boolean;
}

// ─────────────────────────────────────────────────────────────
// Client Configuration
// ─────────────────────────────────────────────────────────────

/**
 * OAuth client configuration (stored in database)
 */
export interface OAuthClient {
  /** Client ID */
  clientId: string;
  /** Client secret (hashed) */
  clientSecretHash?: string;
  /** Client name */
  name: string;
  /** Allowed redirect URIs */
  redirectUris: string[];
  /** Allowed scopes */
  allowedScopes: string[];
  /** Is public client (uses PKCE) */
  isPublic: boolean;
  /** Created timestamp */
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// Validation Types
// ─────────────────────────────────────────────────────────────

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error code (if invalid) */
  error?: string;
  /** Error description (if invalid) */
  errorDescription?: string;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/**
 * Token expiration times in seconds
 */
export const TOKEN_EXPIRY = {
  /** Access token (15 minutes) */
  ACCESS_TOKEN: 15 * 60,
  /** Refresh token (30 days) */
  REFRESH_TOKEN: 30 * 24 * 60 * 60,
  /** Authorization code (10 minutes) */
  AUTH_CODE: 10 * 60,
} as const;

/**
 * OAuth error codes
 */
export const OAUTH_ERRORS = {
  INVALID_REQUEST: 'invalid_request',
  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  ACCESS_DENIED: 'access_denied',
  UNSUPPORTED_RESPONSE_TYPE: 'unsupported_response_type',
  INVALID_SCOPE: 'invalid_scope',
  SERVER_ERROR: 'server_error',
  INVALID_GRANT: 'invalid_grant',
  INVALID_CLIENT: 'invalid_client',
  INVALID_TOKEN: 'invalid_token',
} as const;

export type OAuthErrorCode = typeof OAUTH_ERRORS[keyof typeof OAUTH_ERRORS];
