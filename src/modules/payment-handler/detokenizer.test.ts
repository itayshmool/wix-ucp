/**
 * Payment Detokenizer Tests
 * 
 * Unit tests for the detokenization service.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentDetokenizer } from './detokenizer.js';
import type { WixPaymentsHandlerConfig, DetokenizeRequestPayload } from './types.js';
import type { StoredToken } from '../../lib/redis.js';

// Mock Redis functions
const mockGetToken = vi.fn();
const mockMarkTokenUsed = vi.fn();
const mockDeleteToken = vi.fn();

vi.mock('../../lib/redis.js', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
  markTokenUsed: (...args: unknown[]) => mockMarkTokenUsed(...args),
  deleteToken: (...args: unknown[]) => mockDeleteToken(...args),
  storeToken: vi.fn().mockResolvedValue(undefined),
}));

describe('PaymentDetokenizer', () => {
  let detokenizer: PaymentDetokenizer;
  let config: WixPaymentsHandlerConfig;

  const validStoredToken: StoredToken = {
    id: 'tok_abc123',
    wixCardToken: 'wix_tok_xyz789',
    binding: {
      checkoutId: 'checkout_123',
      businessId: 'merchant_456',
    },
    instrument: {
      type: 'card',
      brand: 'VISA',
      lastDigits: '1111',
      expiryMonth: '12',
      expiryYear: '2028',
    },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min from now
    used: false,
  };

  const validRequest: DetokenizeRequestPayload = {
    token: 'tok_abc123',
    binding: {
      checkoutId: 'checkout_123',
      businessIdentity: {
        type: 'wix_merchant_id',
        value: 'merchant_456',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

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
    detokenizer = new PaymentDetokenizer(config);
  });

  describe('Successful Detokenization', () => {
    it('should detokenize a valid token', async () => {
      mockGetToken.mockResolvedValue(validStoredToken);
      mockMarkTokenUsed.mockResolvedValue(true);

      const result = await detokenizer.detokenize(validRequest);

      expect(result.credential).toBeDefined();
      expect(result.credential.type).toBe('network_token');
      expect(result.invalidated).toBe(true);
    });

    it('should return network token for PAYMENT_GATEWAY mode', async () => {
      mockGetToken.mockResolvedValue(validStoredToken);
      mockMarkTokenUsed.mockResolvedValue(true);

      const result = await detokenizer.detokenize(validRequest);

      expect(result.credential.type).toBe('network_token');
      expect(result.credential.networkToken).toBeDefined();
      expect(result.credential.cryptogram).toBeDefined();
      expect(result.credential.eci).toBeDefined();
    });

    it('should return PAN for DIRECT mode', async () => {
      const directConfig: WixPaymentsHandlerConfig = {
        ...config,
        tokenizationType: 'DIRECT',
      };
      const directDetokenizer = new PaymentDetokenizer(directConfig);

      mockGetToken.mockResolvedValue(validStoredToken);
      mockMarkTokenUsed.mockResolvedValue(true);

      const result = await directDetokenizer.detokenize(validRequest);

      expect(result.credential.type).toBe('pan');
      expect(result.credential.pan).toBeDefined();
    });
  });

  describe('Token Not Found', () => {
    it('should reject non-existent token', async () => {
      mockGetToken.mockResolvedValue(null);

      await expect(detokenizer.detokenize(validRequest)).rejects.toThrow(
        'Payment token not found or expired'
      );
    });
  });

  describe('Single-Use Enforcement', () => {
    it('should reject already used token', async () => {
      const usedToken: StoredToken = {
        ...validStoredToken,
        used: true,
      };
      mockGetToken.mockResolvedValue(usedToken);

      await expect(detokenizer.detokenize(validRequest)).rejects.toThrow(
        'Payment token has already been used'
      );
    });

    it('should handle race condition when marking used', async () => {
      mockGetToken.mockResolvedValue(validStoredToken);
      mockMarkTokenUsed.mockResolvedValue(false); // Another request got there first

      await expect(detokenizer.detokenize(validRequest)).rejects.toThrow(
        'Payment token is no longer available'
      );
    });
  });

  describe('Token Expiration', () => {
    it('should reject expired token', async () => {
      const expiredToken: StoredToken = {
        ...validStoredToken,
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
      };
      mockGetToken.mockResolvedValue(expiredToken);

      await expect(detokenizer.detokenize(validRequest)).rejects.toThrow(
        'Payment token has expired'
      );
    });
  });

  describe('Binding Verification', () => {
    it('should reject token with mismatched checkoutId', async () => {
      mockGetToken.mockResolvedValue(validStoredToken);

      const wrongCheckoutRequest: DetokenizeRequestPayload = {
        ...validRequest,
        binding: {
          ...validRequest.binding,
          checkoutId: 'wrong_checkout_id',
        },
      };

      await expect(detokenizer.detokenize(wrongCheckoutRequest)).rejects.toThrow(
        'Token binding mismatch: checkoutId does not match'
      );
    });

    it('should reject token with mismatched businessId', async () => {
      mockGetToken.mockResolvedValue(validStoredToken);

      const wrongBusinessRequest: DetokenizeRequestPayload = {
        ...validRequest,
        binding: {
          ...validRequest.binding,
          businessIdentity: {
            type: 'wix_merchant_id',
            value: 'wrong_merchant_id',
          },
        },
      };

      await expect(detokenizer.detokenize(wrongBusinessRequest)).rejects.toThrow(
        'Token binding mismatch: businessIdentity does not match'
      );
    });
  });

  describe('Token Invalidation', () => {
    it('should invalidate token', async () => {
      mockDeleteToken.mockResolvedValue(true);

      const result = await detokenizer.invalidateToken('checkout_123', 'tok_abc123');

      expect(result).toBe(true);
      expect(mockDeleteToken).toHaveBeenCalledWith('checkout_123', 'tok_abc123');
    });

    it('should return false when token does not exist', async () => {
      mockDeleteToken.mockResolvedValue(false);

      const result = await detokenizer.invalidateToken('checkout_123', 'nonexistent');

      expect(result).toBe(false);
    });
  });
});
