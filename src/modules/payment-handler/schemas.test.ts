/**
 * Payment Handler Schemas Tests
 * 
 * Unit tests for Zod validation schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  TokenizeRequestSchema,
  DetokenizeRequestSchema,
  CardCredentialSchema,
  TokenBindingSchema,
  BusinessIdentitySchema,
} from './schemas.js';

describe('Payment Handler Schemas', () => {
  describe('BusinessIdentitySchema', () => {
    it('should accept valid business identity', () => {
      const result = BusinessIdentitySchema.safeParse({
        type: 'wix_merchant_id',
        value: 'merchant_123',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid type', () => {
      const result = BusinessIdentitySchema.safeParse({
        type: 'invalid_type',
        value: 'merchant_123',
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty value', () => {
      const result = BusinessIdentitySchema.safeParse({
        type: 'wix_merchant_id',
        value: '',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('TokenBindingSchema', () => {
    it('should accept valid binding', () => {
      const result = TokenBindingSchema.safeParse({
        checkoutId: 'checkout_123',
        businessIdentity: {
          type: 'wix_merchant_id',
          value: 'merchant_456',
        },
      });

      expect(result.success).toBe(true);
    });

    it('should reject missing checkoutId', () => {
      const result = TokenBindingSchema.safeParse({
        businessIdentity: {
          type: 'wix_merchant_id',
          value: 'merchant_456',
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe('CardCredentialSchema', () => {
    const validCard = {
      type: 'card' as const,
      pan: '4111111111111111',
      expiryMonth: '12',
      expiryYear: '2028',
      cvv: '123',
    };

    it('should accept valid card', () => {
      const result = CardCredentialSchema.safeParse(validCard);
      expect(result.success).toBe(true);
    });

    it('should accept card with cardholder name', () => {
      const result = CardCredentialSchema.safeParse({
        ...validCard,
        cardholderName: 'John Doe',
      });
      expect(result.success).toBe(true);
    });

    it('should reject short card number', () => {
      const result = CardCredentialSchema.safeParse({
        ...validCard,
        pan: '411111111111', // 12 digits
      });
      expect(result.success).toBe(false);
    });

    it('should reject card number with letters', () => {
      const result = CardCredentialSchema.safeParse({
        ...validCard,
        pan: '4111XXXX11111111',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid expiry month', () => {
      const result = CardCredentialSchema.safeParse({
        ...validCard,
        expiryMonth: '13', // Invalid month
      });
      expect(result.success).toBe(false);
    });

    it('should accept single-digit expiry month', () => {
      const result = CardCredentialSchema.safeParse({
        ...validCard,
        expiryMonth: '1',
      });
      expect(result.success).toBe(true);
    });

    it('should accept 2-digit expiry year', () => {
      const result = CardCredentialSchema.safeParse({
        ...validCard,
        expiryYear: '28',
      });
      expect(result.success).toBe(true);
    });

    it('should reject 3-digit expiry year', () => {
      const result = CardCredentialSchema.safeParse({
        ...validCard,
        expiryYear: '202', // Invalid
      });
      expect(result.success).toBe(false);
    });

    it('should reject CVV with 2 digits', () => {
      const result = CardCredentialSchema.safeParse({
        ...validCard,
        cvv: '12',
      });
      expect(result.success).toBe(false);
    });

    it('should accept CVV with 4 digits (AMEX)', () => {
      const result = CardCredentialSchema.safeParse({
        ...validCard,
        cvv: '1234',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('TokenizeRequestSchema', () => {
    const validRequest = {
      sourceCredential: {
        type: 'card' as const,
        pan: '4111111111111111',
        expiryMonth: '12',
        expiryYear: '2028',
        cvv: '123',
      },
      binding: {
        checkoutId: 'checkout_123',
        businessIdentity: {
          type: 'wix_merchant_id' as const,
          value: 'merchant_456',
        },
      },
    };

    it('should accept valid tokenize request', () => {
      const result = TokenizeRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should accept request with metadata', () => {
      const result = TokenizeRequestSchema.safeParse({
        ...validRequest,
        metadata: { source: 'web', sessionId: 'sess_123' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept Google Pay credential', () => {
      const result = TokenizeRequestSchema.safeParse({
        sourceCredential: {
          type: 'googlePay',
          googlePayToken: 'gpay_token_abc123',
        },
        binding: validRequest.binding,
      });
      expect(result.success).toBe(true);
    });

    it('should accept Apple Pay credential', () => {
      const result = TokenizeRequestSchema.safeParse({
        sourceCredential: {
          type: 'applePay',
          applePayToken: 'applepay_token_xyz789',
        },
        binding: validRequest.binding,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing binding', () => {
      const result = TokenizeRequestSchema.safeParse({
        sourceCredential: validRequest.sourceCredential,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('DetokenizeRequestSchema', () => {
    const validRequest = {
      token: 'tok_abc123def456',
      binding: {
        checkoutId: 'checkout_123',
        businessIdentity: {
          type: 'wix_merchant_id' as const,
          value: 'merchant_456',
        },
      },
    };

    it('should accept valid detokenize request', () => {
      const result = DetokenizeRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should accept request with PSP delegation', () => {
      const result = DetokenizeRequestSchema.safeParse({
        ...validRequest,
        delegatedTo: {
          type: 'psp',
          identity: 'stripe_merchant_xyz',
        },
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty token', () => {
      const result = DetokenizeRequestSchema.safeParse({
        ...validRequest,
        token: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing binding', () => {
      const result = DetokenizeRequestSchema.safeParse({
        token: validRequest.token,
      });
      expect(result.success).toBe(false);
    });
  });
});
