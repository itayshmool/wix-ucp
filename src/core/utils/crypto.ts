/**
 * Cryptographic Utility Functions
 * 
 * Token generation, verification, and cryptographic helpers.
 */

import { createHmac, randomBytes, createHash } from 'crypto';
import { nanoid } from 'nanoid';

/**
 * Token binding payload
 */
interface TokenBinding {
  checkoutId: string;
  businessId: string;
  tokenId: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Get JWT secret from environment
 */
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

/**
 * Generate a checkout-bound token
 * 
 * Creates a token that is cryptographically bound to a specific
 * checkout session and business, preventing replay attacks.
 */
export function generateBoundToken(
  checkoutId: string,
  businessId: string,
  ttlSeconds: number = 900 // 15 minutes default
): { token: string; tokenId: string; expiresAt: Date } {
  const tokenId = nanoid(21);
  const now = Date.now();
  const expiresAt = now + (ttlSeconds * 1000);

  const binding: TokenBinding = {
    checkoutId,
    businessId,
    tokenId,
    createdAt: now,
    expiresAt,
  };

  // Create binding payload
  const payload = JSON.stringify(binding);
  const payloadBase64 = Buffer.from(payload).toString('base64url');

  // Create HMAC signature
  const signature = createHmac('sha256', getSecret())
    .update(payloadBase64)
    .digest('base64url');

  // Combine into token
  const token = `${payloadBase64}.${signature}`;

  return {
    token,
    tokenId,
    expiresAt: new Date(expiresAt),
  };
}

/**
 * Verify and extract token binding
 * 
 * Returns the binding if valid, or null if invalid/expired.
 */
export function verifyTokenBinding(
  token: string,
  checkoutId: string,
  businessId: string
): TokenBinding | null {
  try {
    const [payloadBase64, signature] = token.split('.');
    
    if (!payloadBase64 || !signature) {
      return null;
    }

    // Verify signature
    const expectedSignature = createHmac('sha256', getSecret())
      .update(payloadBase64)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return null;
    }

    // Decode and parse payload
    const payload = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const binding = JSON.parse(payload) as TokenBinding;

    // Verify binding matches
    if (binding.checkoutId !== checkoutId || binding.businessId !== businessId) {
      return null;
    }

    // Verify not expired
    if (Date.now() > binding.expiresAt) {
      return null;
    }

    return binding;
  } catch {
    return null;
  }
}

/**
 * Check if a token is bound to a specific checkout
 */
export function isTokenBoundTo(
  token: string,
  checkoutId: string,
  businessId: string
): boolean {
  return verifyTokenBinding(token, checkoutId, businessId) !== null;
}

/**
 * Generate a unique idempotency key
 */
export function generateIdempotencyKey(): string {
  return `idem_${nanoid(24)}`;
}

/**
 * Generate a random state for OAuth
 */
export function generateOAuthState(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Generate PKCE code verifier
 */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Generate PKCE code challenge from verifier
 */
export function generateCodeChallenge(verifier: string): string {
  return createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

/**
 * Verify PKCE code challenge
 */
export function verifyCodeChallenge(verifier: string, challenge: string): boolean {
  const computed = generateCodeChallenge(verifier);
  return computed === challenge;
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('base64url');
}

/**
 * Generate authorization code for OAuth
 */
export function generateAuthorizationCode(): string {
  return `authz_${nanoid(32)}`;
}

/**
 * Generate access token for OAuth
 */
export function generateAccessToken(): string {
  return `at_${nanoid(48)}`;
}

/**
 * Generate refresh token for OAuth
 */
export function generateRefreshToken(): string {
  return `rt_${nanoid(48)}`;
}

/**
 * Hash a value for safe storage/comparison
 */
export function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Compare a value against its hash (constant-time)
 */
export function verifyHash(value: string, hash: string): boolean {
  const computed = hashValue(value);
  
  // Constant-time comparison
  if (computed.length !== hash.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < computed.length; i++) {
    result |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  
  return result === 0;
}
