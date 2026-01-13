/**
 * Identity Types
 * 
 * Type definitions for UCP Identity Linking capability.
 */

/**
 * OAuth 2.0 authorization request
 */
export interface AuthorizeRequest {
  /** Response type (always "code" for authorization code flow) */
  response_type: 'code';
  /** Client identifier */
  client_id: string;
  /** Redirect URI after authorization */
  redirect_uri: string;
  /** Requested scopes (space-separated) */
  scope: string;
  /** CSRF protection state parameter */
  state: string;
  /** PKCE code challenge (optional) */
  code_challenge?: string;
  /** PKCE code challenge method (optional) */
  code_challenge_method?: 'S256';
}

/**
 * OAuth 2.0 token request
 */
export interface TokenRequest {
  /** Grant type */
  grant_type: 'authorization_code' | 'refresh_token';
  /** Authorization code (for authorization_code grant) */
  code?: string;
  /** Redirect URI (must match authorize request) */
  redirect_uri?: string;
  /** Client identifier */
  client_id: string;
  /** Client secret (optional) */
  client_secret?: string;
  /** PKCE code verifier (optional) */
  code_verifier?: string;
  /** Refresh token (for refresh_token grant) */
  refresh_token?: string;
}

/**
 * OAuth 2.0 token response
 */
export interface TokenResponse {
  /** Access token */
  access_token: string;
  /** Token type (always "Bearer") */
  token_type: 'Bearer';
  /** Access token expiration in seconds */
  expires_in: number;
  /** Refresh token (optional) */
  refresh_token?: string;
  /** Granted scopes (space-separated) */
  scope: string;
}

/**
 * User info response
 */
export interface UserInfoResponse {
  /** Unique user identifier */
  sub: string;
  /** User's email address */
  email?: string;
  /** Whether email is verified */
  email_verified?: boolean;
  /** User's full name */
  name?: string;
  /** User's given/first name */
  given_name?: string;
  /** User's family/last name */
  family_name?: string;
  /** URL to user's profile picture */
  picture?: string;
  /** User's phone number */
  phone_number?: string;
  /** Whether phone is verified */
  phone_number_verified?: boolean;
  /** User's address */
  address?: {
    formatted?: string;
    street_address?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
}

/**
 * OAuth session stored in database
 */
export interface OAuthSession {
  /** Session ID */
  id: string;
  /** Client ID */
  clientId: string;
  /** Redirect URI */
  redirectUri: string;
  /** Requested scopes */
  scopes: string[];
  /** CSRF state */
  state: string;
  /** PKCE code challenge (optional) */
  codeChallenge?: string;
  /** Authorization code (after consent) */
  authorizationCode?: string;
  /** Associated Wix member ID (after consent) */
  memberId?: string;
  /** Session status */
  status: 'pending' | 'authorized' | 'exchanged' | 'revoked';
  /** Creation timestamp */
  createdAt: Date;
  /** Expiration timestamp */
  expiresAt: Date;
}

/**
 * User consent record
 */
export interface UserConsent {
  /** Consent ID */
  id: string;
  /** Wix member ID */
  memberId: string;
  /** Client ID */
  clientId: string;
  /** Granted scopes */
  scopes: string[];
  /** Consent granted at */
  grantedAt: Date;
  /** Consent revoked at (optional) */
  revokedAt?: Date;
}

/**
 * Identity linking scopes
 */
export const IdentityScopes = {
  /** Read user profile */
  PROFILE: 'profile',
  /** Read user email */
  EMAIL: 'email',
  /** Read user phone */
  PHONE: 'phone',
  /** Read user addresses */
  ADDRESS: 'address',
  /** Read user orders */
  ORDERS_READ: 'orders:read',
  /** Write user orders */
  ORDERS_WRITE: 'orders:write',
  /** Offline access (refresh tokens) */
  OFFLINE_ACCESS: 'offline_access',
} as const;

export type IdentityScope = typeof IdentityScopes[keyof typeof IdentityScopes];
