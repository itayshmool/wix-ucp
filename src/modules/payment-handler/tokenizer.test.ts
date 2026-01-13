/**
 * Payment Tokenizer Tests
 * 
 * Unit tests for the tokenization service.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentTokenizer } from './tokenizer.js';
import type { WixPaymentsHandlerConfig, TokenizeRequestPayload } from './types.js';

// Mock Redis
vi.mock('../../lib/redis.js', () => ({
  storeToken: vi.fn().mockResolvedValue(undefined),
  getToken: vi.fn().mockResolvedValue(null),
  markTokenUsed: vi.fn().mockResolvedValue(true),
  deleteToken: vi.fn().mockResolvedValue(true),
}));

describe('PaymentTokenizer', () => {
  let tokenizer: PaymentTokenizer;
  let config: WixPaymentsHandlerConfig;

  beforeEach(() => {
    config = {
      merchantId: 'test_merchant_123',
      environment: 'sandbox',
      supportedCardNetworks: ['VISA', 'MASTERCARD', 'AMEX', 'DISCOVER'],
      supportedPaymentMethods: ['creditCard', 'googlePay', 'applePay'],
      supportedCurrencies: ['USD', 'EUR'],
      threeDSEnabled: true,
      recurringEnabled: true,
      tokenizationType: 'PAYMENT_GATEWAY',
    };
    tokenizer = new PaymentTokenizer(config);
  });

  describe('Card Brand Detection', () => {
    it('should detect Visa cards', () => {
      const result = tokenizer.detectCardBrand('4111111111111111');
      expect(result).toEqual({ brand: 'VISA', brandName: 'Visa' });
    });

    it('should detect Mastercard cards (5xxx)', () => {
      const result = tokenizer.detectCardBrand('5111111111111111');
      expect(result).toEqual({ brand: 'MASTERCARD', brandName: 'Mastercard' });
    });

    it('should detect Mastercard cards (2xxx)', () => {
      const result = tokenizer.detectCardBrand('2221111111111111');
      expect(result).toEqual({ brand: 'MASTERCARD', brandName: 'Mastercard' });
    });

    it('should detect American Express cards', () => {
      const result = tokenizer.detectCardBrand('371111111111111');
      expect(result).toEqual({ brand: 'AMEX', brandName: 'American Express' });
    });

    it('should detect Discover cards', () => {
      const result = tokenizer.detectCardBrand('6011111111111111');
      expect(result).toEqual({ brand: 'DISCOVER', brandName: 'Discover' });
    });

    it('should return undefined for unknown cards', () => {
      const result = tokenizer.detectCardBrand('9999999999999999');
      expect(result).toBeUndefined();
    });

    it('should handle card numbers with spaces', () => {
      const result = tokenizer.detectCardBrand('4111 1111 1111 1111');
      expect(result).toEqual({ brand: 'VISA', brandName: 'Visa' });
    });
  });

  describe('Tokenization', () => {
    const validCardRequest: TokenizeRequestPayload = {
      sourceCredential: {
        type: 'card',
        pan: '4111111111111111',
        expiryMonth: '12',
        expiryYear: '2028',
        cvv: '123',
      },
      binding: {
        checkoutId: 'checkout_123',
        businessIdentity: {
          type: 'wix_merchant_id',
          value: 'merchant_456',
        },
      },
    };

    it('should tokenize a valid card', async () => {
      const result = await tokenizer.tokenize(validCardRequest);

      expect(result.token).toBeDefined();
      expect(result.token).toMatch(/^tok_[a-f0-9]+$/);
      expect(result.expiresAt).toBeDefined();
      expect(result.instrument).toEqual({
        type: 'card',
        brand: 'VISA',
        lastDigits: '1111',
        expiryMonth: '12',
        expiryYear: '2028',
      });
    });

    it('should reject unsupported payment method', async () => {
      const configWithLimitedMethods: WixPaymentsHandlerConfig = {
        ...config,
        supportedPaymentMethods: ['creditCard'], // No Google Pay
      };
      const limitedTokenizer = new PaymentTokenizer(configWithLimitedMethods);

      const googlePayRequest: TokenizeRequestPayload = {
        sourceCredential: {
          type: 'googlePay',
          googlePayToken: 'gpay_token_123',
        },
        binding: validCardRequest.binding,
      };

      await expect(limitedTokenizer.tokenize(googlePayRequest)).rejects.toThrow(
        'Payment method googlePay is not supported'
      );
    });

    it('should reject unsupported card network', async () => {
      const configWithLimitedNetworks: WixPaymentsHandlerConfig = {
        ...config,
        supportedCardNetworks: ['VISA'], // No Mastercard
      };
      const limitedTokenizer = new PaymentTokenizer(configWithLimitedNetworks);

      const mastercardRequest: TokenizeRequestPayload = {
        ...validCardRequest,
        sourceCredential: {
          type: 'card',
          pan: '5111111111111111', // Mastercard
          expiryMonth: '12',
          expiryYear: '2028',
          cvv: '123',
        },
      };

      await expect(limitedTokenizer.tokenize(mastercardRequest)).rejects.toThrow(
        'Card network Mastercard is not supported'
      );
    });

    it('should reject card with missing CVV', async () => {
      const invalidRequest: TokenizeRequestPayload = {
        sourceCredential: {
          type: 'card',
          pan: '4111111111111111',
          expiryMonth: '12',
          expiryYear: '2028',
          // Missing CVV
        },
        binding: validCardRequest.binding,
      };

      await expect(tokenizer.tokenize(invalidRequest)).rejects.toThrow(
        'Card credentials require pan, expiryMonth, expiryYear, and cvv'
      );
    });

    it('should reject Google Pay with missing token', async () => {
      const invalidRequest: TokenizeRequestPayload = {
        sourceCredential: {
          type: 'googlePay',
          // Missing googlePayToken
        },
        binding: validCardRequest.binding,
      };

      await expect(tokenizer.tokenize(invalidRequest)).rejects.toThrow(
        'Google Pay requires googlePayToken'
      );
    });

    it('should reject Apple Pay with missing token', async () => {
      const invalidRequest: TokenizeRequestPayload = {
        sourceCredential: {
          type: 'applePay',
          // Missing applePayToken
        },
        binding: validCardRequest.binding,
      };

      await expect(tokenizer.tokenize(invalidRequest)).rejects.toThrow(
        'Apple Pay requires applePayToken'
      );
    });

    it('should tokenize Google Pay credential', async () => {
      const googlePayRequest: TokenizeRequestPayload = {
        sourceCredential: {
          type: 'googlePay',
          googlePayToken: 'gpay_token_123',
        },
        binding: validCardRequest.binding,
      };

      const result = await tokenizer.tokenize(googlePayRequest);

      expect(result.token).toBeDefined();
      expect(result.instrument.type).toBe('wallet');
    });

    it('should set expiration 15 minutes in the future', async () => {
      const before = Date.now();
      const result = await tokenizer.tokenize(validCardRequest);
      const after = Date.now();

      const expiresAt = new Date(result.expiresAt).getTime();
      const expectedMin = before + 15 * 60 * 1000;
      const expectedMax = after + 15 * 60 * 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt).toBeLessThanOrEqual(expectedMax);
    });
  });
});
