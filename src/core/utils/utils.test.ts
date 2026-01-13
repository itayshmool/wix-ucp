/**
 * Utility Functions Tests
 * 
 * Tests for error, crypto, and validation utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import {
  createUCPError,
  createFieldError,
  createMissingFieldError,
  createNotFoundError,
  createRateLimitError,
  createInternalError,
  mapWixErrorToUCP,
  getStatusForError,
  isRetryableError,
  zodErrorsToDetails,
  createValidationError,
} from './errors.js';
import {
  generateBoundToken,
  verifyTokenBinding,
  isTokenBoundTo,
  generateIdempotencyKey,
  generateOAuthState,
  generateCodeVerifier,
  generateCodeChallenge,
  verifyCodeChallenge,
  generateSecureToken,
  generateAuthorizationCode,
  generateAccessToken,
  generateRefreshToken,
  hashValue,
  verifyHash,
} from './crypto.js';
import {
  validate,
  validateOrThrow,
  requireOneOf,
  requireAll,
  stripUndefined,
  isValidUUID,
  isValidDateTime,
  isValidCurrency,
  isValidCountryCode,
} from './validation.js';
import { UCPException } from '../types/index.js';

describe('Error Utilities', () => {
  describe('createUCPError', () => {
    it('should create a basic error', () => {
      const error = createUCPError('NOT_FOUND', 'Resource not found');
      
      expect(error.error.code).toBe('NOT_FOUND');
      expect(error.error.message).toBe('Resource not found');
      expect(error.error.retryable).toBe(false);
    });

    it('should create an error with details', () => {
      const error = createUCPError('INVALID_FIELD', 'Validation failed', {
        details: [{ field: 'email', code: 'INVALID', message: 'Invalid email' }],
      });
      
      expect(error.error.details).toHaveLength(1);
      expect(error.error.details?.[0]?.field).toBe('email');
    });

    it('should create a retryable error', () => {
      const error = createUCPError('RATE_LIMITED', 'Too many requests', {
        retryable: true,
        retryAfter: 60,
      });
      
      expect(error.error.retryable).toBe(true);
      expect(error.error.retryAfter).toBe(60);
    });
  });

  describe('createFieldError', () => {
    it('should create a field validation error', () => {
      const error = createFieldError('email', 'Invalid email format');
      
      expect(error.error.code).toBe('INVALID_FIELD');
      expect(error.error.details?.[0]?.field).toBe('email');
    });
  });

  describe('createMissingFieldError', () => {
    it('should create a missing field error', () => {
      const error = createMissingFieldError('email');
      
      expect(error.error.code).toBe('MISSING_FIELD');
      expect(error.error.details?.[0]?.code).toBe('REQUIRED');
    });
  });

  describe('createNotFoundError', () => {
    it('should create a not found error with ID', () => {
      const error = createNotFoundError('Checkout', 'abc123');
      
      expect(error.error.code).toBe('NOT_FOUND');
      expect(error.error.message).toContain('abc123');
    });

    it('should create a not found error without ID', () => {
      const error = createNotFoundError('Checkout');
      
      expect(error.error.message).toBe('Checkout not found');
    });
  });

  describe('createRateLimitError', () => {
    it('should create a rate limit error', () => {
      const error = createRateLimitError(30);
      
      expect(error.error.code).toBe('RATE_LIMITED');
      expect(error.error.retryable).toBe(true);
      expect(error.error.retryAfter).toBe(30);
    });
  });

  describe('createInternalError', () => {
    it('should create a sanitized internal error', () => {
      const error = createInternalError();
      
      expect(error.error.code).toBe('INTERNAL_ERROR');
      expect(error.error.message).not.toContain('stack');
    });
  });

  describe('mapWixErrorToUCP', () => {
    it('should map Wix NOT_FOUND error', () => {
      const error = mapWixErrorToUCP({
        code: 'NOT_FOUND',
        message: 'Order not found',
      });
      
      expect(error.error.code).toBe('NOT_FOUND');
    });

    it('should map by HTTP status', () => {
      const error = mapWixErrorToUCP({
        message: 'Server error',
        status: 500,
      });
      
      expect(error.error.code).toBe('INTERNAL_ERROR');
      expect(error.error.retryable).toBe(true);
    });

    it('should default to internal error', () => {
      const error = mapWixErrorToUCP({ message: 'Unknown error' });
      
      expect(error.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('getStatusForError', () => {
    it('should return correct HTTP status', () => {
      expect(getStatusForError('NOT_FOUND')).toBe(404);
      expect(getStatusForError('UNAUTHORIZED')).toBe(401);
      expect(getStatusForError('RATE_LIMITED')).toBe(429);
    });
  });

  describe('isRetryableError', () => {
    it('should detect retryable UCPError', () => {
      const error = createRateLimitError(60);
      expect(isRetryableError(error)).toBe(true);
    });

    it('should detect non-retryable UCPError', () => {
      const error = createNotFoundError('Resource');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should detect retryable UCPException', () => {
      const error = new UCPException('RATE_LIMITED', 'Too many requests', {
        retryable: true,
      });
      expect(isRetryableError(error)).toBe(true);
    });
  });

  describe('zodErrorsToDetails', () => {
    it('should convert Zod errors to details', () => {
      const errors = [
        { path: ['buyer', 'email'], message: 'Invalid email' },
        { path: ['lineItems', 0, 'quantity'], message: 'Must be positive' },
      ];
      
      const details = zodErrorsToDetails(errors);
      
      expect(details[0]?.field).toBe('buyer.email');
      expect(details[1]?.field).toBe('lineItems.0.quantity');
    });
  });

  describe('createValidationError', () => {
    it('should create validation error from Zod errors', () => {
      const errors = [{ path: ['email'], message: 'Invalid email' }];
      const error = createValidationError(errors);
      
      expect(error.error.code).toBe('INVALID_REQUEST');
      expect(error.error.details).toHaveLength(1);
    });
  });
});

describe('Crypto Utilities', () => {
  // Set up JWT_SECRET for tests
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateBoundToken / verifyTokenBinding', () => {
    it('should generate and verify a valid token', () => {
      const checkoutId = 'checkout-123';
      const businessId = 'business-456';
      
      const { token, tokenId, expiresAt } = generateBoundToken(checkoutId, businessId);
      
      expect(token).toBeTruthy();
      expect(tokenId).toBeTruthy();
      expect(expiresAt).toBeInstanceOf(Date);
      
      const binding = verifyTokenBinding(token, checkoutId, businessId);
      expect(binding).not.toBeNull();
      expect(binding?.checkoutId).toBe(checkoutId);
      expect(binding?.businessId).toBe(businessId);
    });

    it('should reject token with wrong checkoutId', () => {
      const { token } = generateBoundToken('checkout-123', 'business-456');
      
      const binding = verifyTokenBinding(token, 'wrong-checkout', 'business-456');
      expect(binding).toBeNull();
    });

    it('should reject token with wrong businessId', () => {
      const { token } = generateBoundToken('checkout-123', 'business-456');
      
      const binding = verifyTokenBinding(token, 'checkout-123', 'wrong-business');
      expect(binding).toBeNull();
    });

    it('should reject tampered token', () => {
      const { token } = generateBoundToken('checkout-123', 'business-456');
      const tamperedToken = token + 'tampered';
      
      const binding = verifyTokenBinding(tamperedToken, 'checkout-123', 'business-456');
      expect(binding).toBeNull();
    });

    it('should reject malformed token', () => {
      const binding = verifyTokenBinding('malformed', 'checkout-123', 'business-456');
      expect(binding).toBeNull();
    });
  });

  describe('isTokenBoundTo', () => {
    it('should return true for valid binding', () => {
      const { token } = generateBoundToken('checkout-123', 'business-456');
      expect(isTokenBoundTo(token, 'checkout-123', 'business-456')).toBe(true);
    });

    it('should return false for invalid binding', () => {
      const { token } = generateBoundToken('checkout-123', 'business-456');
      expect(isTokenBoundTo(token, 'wrong', 'business-456')).toBe(false);
    });
  });

  describe('generateIdempotencyKey', () => {
    it('should generate unique keys', () => {
      const key1 = generateIdempotencyKey();
      const key2 = generateIdempotencyKey();
      
      expect(key1).toMatch(/^idem_/);
      expect(key1).not.toBe(key2);
    });
  });

  describe('generateOAuthState', () => {
    it('should generate random state', () => {
      const state1 = generateOAuthState();
      const state2 = generateOAuthState();
      
      expect(state1).toBeTruthy();
      expect(state1).not.toBe(state2);
    });
  });

  describe('PKCE', () => {
    it('should generate and verify code challenge', () => {
      const verifier = generateCodeVerifier();
      const challenge = generateCodeChallenge(verifier);
      
      expect(verifyCodeChallenge(verifier, challenge)).toBe(true);
    });

    it('should reject wrong verifier', () => {
      const verifier = generateCodeVerifier();
      const challenge = generateCodeChallenge(verifier);
      const wrongVerifier = generateCodeVerifier();
      
      expect(verifyCodeChallenge(wrongVerifier, challenge)).toBe(false);
    });
  });

  describe('Token Generation', () => {
    it('should generate secure token', () => {
      const token = generateSecureToken();
      expect(token.length).toBeGreaterThan(20);
    });

    it('should generate authorization code', () => {
      const code = generateAuthorizationCode();
      expect(code).toMatch(/^authz_/);
    });

    it('should generate access token', () => {
      const token = generateAccessToken();
      expect(token).toMatch(/^at_/);
    });

    it('should generate refresh token', () => {
      const token = generateRefreshToken();
      expect(token).toMatch(/^rt_/);
    });
  });

  describe('hashValue / verifyHash', () => {
    it('should hash and verify value', () => {
      const value = 'secret-value';
      const hash = hashValue(value);
      
      expect(verifyHash(value, hash)).toBe(true);
    });

    it('should reject wrong value', () => {
      const hash = hashValue('correct-value');
      expect(verifyHash('wrong-value', hash)).toBe(false);
    });
  });
});

describe('Validation Utilities', () => {
  const TestSchema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  });

  describe('validate', () => {
    it('should return success for valid data', () => {
      const result = validate(TestSchema, { name: 'John', age: 30 });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('John');
      }
    });

    it('should return error for invalid data', () => {
      const result = validate(TestSchema, { name: '', age: -1 });
      
      expect(result.success).toBe(false);
    });
  });

  describe('validateOrThrow', () => {
    it('should return data for valid input', () => {
      const data = validateOrThrow(TestSchema, { name: 'John', age: 30 });
      expect(data.name).toBe('John');
    });

    it('should throw UCPException for invalid input', () => {
      expect(() => validateOrThrow(TestSchema, { name: '' })).toThrow(UCPException);
    });
  });

  describe('requireOneOf', () => {
    it('should return true if at least one field present', () => {
      expect(requireOneOf({ a: 1, b: undefined }, ['a', 'b'])).toBe(true);
    });

    it('should return false if no fields present', () => {
      expect(requireOneOf({ a: undefined, b: undefined }, ['a', 'b'])).toBe(false);
    });
  });

  describe('requireAll', () => {
    it('should return true if all fields present', () => {
      expect(requireAll({ a: 1, b: 2 }, ['a', 'b'])).toBe(true);
    });

    it('should return false if any field missing', () => {
      expect(requireAll({ a: 1, b: undefined }, ['a', 'b'])).toBe(false);
    });
  });

  describe('stripUndefined', () => {
    it('should remove undefined values', () => {
      const result = stripUndefined({ a: 1, b: undefined, c: 'test' });
      
      expect(result).toEqual({ a: 1, c: 'test' });
      expect('b' in result).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUID', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should reject invalid UUID', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
    });
  });

  describe('isValidDateTime', () => {
    it('should validate correct ISO 8601', () => {
      expect(isValidDateTime('2026-01-13T12:00:00.000Z')).toBe(true);
    });

    it('should reject invalid date', () => {
      expect(isValidDateTime('not-a-date')).toBe(false);
    });
  });

  describe('isValidCurrency', () => {
    it('should validate correct currency code', () => {
      expect(isValidCurrency('USD')).toBe(true);
      expect(isValidCurrency('EUR')).toBe(true);
    });

    it('should reject invalid currency', () => {
      expect(isValidCurrency('us')).toBe(false);
      expect(isValidCurrency('USDD')).toBe(false);
    });
  });

  describe('isValidCountryCode', () => {
    it('should validate correct country code', () => {
      expect(isValidCountryCode('US')).toBe(true);
      expect(isValidCountryCode('GB')).toBe(true);
    });

    it('should reject invalid country', () => {
      expect(isValidCountryCode('usa')).toBe(false);
      expect(isValidCountryCode('U')).toBe(false);
    });
  });
});
