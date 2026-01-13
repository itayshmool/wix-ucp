/**
 * Identity Validation Schemas
 * 
 * Zod schemas for OAuth 2.0 identity linking requests.
 */

import { z } from 'zod';

/**
 * Authorization request schema
 */
export const AuthorizeRequestSchema = z.object({
  /** Response type (must be "code") */
  response_type: z.literal('code'),
  /** Client ID */
  client_id: z.string().min(1, 'Client ID is required'),
  /** Redirect URI */
  redirect_uri: z.string().url('Invalid redirect URI'),
  /** Requested scopes (space-separated) */
  scope: z.string().min(1, 'At least one scope is required'),
  /** CSRF state parameter */
  state: z.string().min(1, 'State is required'),
  /** PKCE code challenge */
  code_challenge: z.string().min(43).max(128).optional(),
  /** PKCE code challenge method */
  code_challenge_method: z.literal('S256').optional(),
});

/**
 * Token request schema (authorization code grant)
 */
export const TokenRequestAuthCodeSchema = z.object({
  grant_type: z.literal('authorization_code'),
  /** Authorization code */
  code: z.string().min(1, 'Code is required'),
  /** Redirect URI (must match authorize request) */
  redirect_uri: z.string().url('Invalid redirect URI'),
  /** Client ID */
  client_id: z.string().min(1, 'Client ID is required'),
  /** Client secret */
  client_secret: z.string().optional(),
  /** PKCE code verifier */
  code_verifier: z.string().min(43).max(128).optional(),
});

/**
 * Token request schema (refresh token grant)
 */
export const TokenRequestRefreshSchema = z.object({
  grant_type: z.literal('refresh_token'),
  /** Refresh token */
  refresh_token: z.string().min(1, 'Refresh token is required'),
  /** Client ID */
  client_id: z.string().min(1, 'Client ID is required'),
  /** Client secret */
  client_secret: z.string().optional(),
});

/**
 * Token request schema (union)
 */
export const TokenRequestSchema = z.discriminatedUnion('grant_type', [
  TokenRequestAuthCodeSchema,
  TokenRequestRefreshSchema,
]);

/**
 * Revoke request schema
 */
export const RevokeRequestSchema = z.object({
  /** Token to revoke */
  token: z.string().min(1, 'Token is required'),
  /** Token type hint */
  token_type_hint: z.enum(['access_token', 'refresh_token']).optional(),
  /** Client ID */
  client_id: z.string().min(1, 'Client ID is required'),
});

/**
 * Scope validation helper
 */
export const ScopeSchema = z.string().transform((val) => val.split(' ').filter(Boolean));

/**
 * Supported scopes enum
 */
export const SupportedScopeSchema = z.enum([
  'profile',
  'email',
  'phone',
  'address',
  'orders:read',
  'orders:write',
  'offline_access',
]);

// Type exports
export type AuthorizeInput = z.input<typeof AuthorizeRequestSchema>;
export type TokenInput = z.input<typeof TokenRequestSchema>;
export type RevokeInput = z.input<typeof RevokeRequestSchema>;
