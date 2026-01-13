/**
 * Payment Handler Tests
 * 
 * Unit tests for the main payment handler.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mock functions that can be referenced in vi.mock
const { mockDeleteToken, mockStoreToken, mockGetToken, mockMarkTokenUsed } = vi.hoisted(() => ({
  mockDeleteToken: vi.fn(() => Promise.resolve(true)),
  mockStoreToken: vi.fn(() => Promise.resolve(undefined)),
  mockGetToken: vi.fn(() => Promise.resolve(null)),
  mockMarkTokenUsed: vi.fn(() => Promise.resolve(true)),
}));

// Mock Redis module
vi.mock('../../lib/redis.js', () => ({
  storeToken: mockStoreToken,
  getToken: mockGetToken,
  markTokenUsed: mockMarkTokenUsed,
  deleteToken: mockDeleteToken,
  REDIS_KEYS: {
    token: (checkoutId: string, tokenId: string) => `token:${checkoutId}:${tokenId}`,
  },
}));

// Now import handler (will use mocked redis)
import { WixPaymentsHandler, createWixPaymentsHandler, createDefaultHandler } from './handler.js';
import { HANDLER_IDENTITY } from './config.js';

describe('WixPaymentsHandler', () => {
  let handler: WixPaymentsHandler;

  beforeEach(() => {
    handler = createWixPaymentsHandler('test_merchant_123');
  });

  describe('Handler Declaration', () => {
    it('should return correct handler identity', () => {
      const declaration = handler.getHandlerDeclaration();

      expect(declaration.name).toBe(HANDLER_IDENTITY.name);
      expect(declaration.version).toBe(HANDLER_IDENTITY.version);
      expect(declaration.spec).toBe(HANDLER_IDENTITY.spec);
    });

    it('should include handler ID based on merchant', () => {
      const declaration = handler.getHandlerDeclaration();

      expect(declaration.id).toContain('wix_pay_handler_');
      expect(declaration.id).toContain('_123'); // Last 6 chars of merchant ID
    });

    it('should include supported networks in config', () => {
      const declaration = handler.getHandlerDeclaration();

      expect(declaration.config.supportedNetworks).toContain('VISA');
      expect(declaration.config.supportedNetworks).toContain('MASTERCARD');
    });

    it('should include supported currencies', () => {
      const declaration = handler.getHandlerDeclaration();

      expect(declaration.config.supportedCurrencies).toContain('USD');
      expect(declaration.config.supportedCurrencies).toContain('EUR');
    });

    it('should indicate tokenization support', () => {
      const declaration = handler.getHandlerDeclaration();

      expect(declaration.config.supportsTokenization).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should return readonly configuration', () => {
      const config = handler.getConfig();

      expect(config.merchantId).toBe('test_merchant_123');
      expect(config.environment).toBe('sandbox');
    });

    it('should allow config overrides', () => {
      const customHandler = createWixPaymentsHandler('merchant_456', {
        environment: 'production',
        supportedCardNetworks: ['VISA'],
      });

      const config = customHandler.getConfig();

      expect(config.environment).toBe('production');
      expect(config.supportedCardNetworks).toEqual(['VISA']);
    });
  });

  describe('Tokenization', () => {
    it('should tokenize valid card', async () => {
      const result = await handler.tokenize({
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
      });

      expect(result.token).toBeDefined();
      expect(result.instrument.type).toBe('card');
      expect(result.instrument.brand).toBe('VISA');
    });

    it('should propagate validation errors', async () => {
      await expect(
        handler.tokenize({
          sourceCredential: {
            type: 'card',
            pan: '4111111111111111',
            expiryMonth: '12',
            expiryYear: '2028',
            // Missing CVV
          },
          binding: {
            checkoutId: 'checkout_123',
            businessIdentity: {
              type: 'wix_merchant_id',
              value: 'merchant_456',
            },
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Token Invalidation', () => {
    it('should invalidate token', async () => {
      const result = await handler.invalidateToken('checkout_123', 'tok_abc123');

      expect(result).toBe(true);
      expect(mockDeleteToken).toHaveBeenCalledWith('checkout_123', 'tok_abc123');
    });
  });

  describe('Factory Functions', () => {
    it('should create handler with merchant ID', () => {
      const newHandler = createWixPaymentsHandler('new_merchant');
      const config = newHandler.getConfig();

      expect(config.merchantId).toBe('new_merchant');
    });

    it('should create default handler from env', () => {
      // Set env for test
      const originalEnv = process.env.WIX_ACCOUNT_ID;
      process.env.WIX_ACCOUNT_ID = 'env_merchant_789';

      const defaultHandler = createDefaultHandler();
      const config = defaultHandler.getConfig();

      expect(config.merchantId).toBe('env_merchant_789');

      // Restore
      process.env.WIX_ACCOUNT_ID = originalEnv;
    });

    it('should use default merchant when env not set', () => {
      const originalEnv = process.env.WIX_ACCOUNT_ID;
      delete process.env.WIX_ACCOUNT_ID;

      const defaultHandler = createDefaultHandler();
      const config = defaultHandler.getConfig();

      expect(config.merchantId).toBe('default_merchant');

      // Restore
      process.env.WIX_ACCOUNT_ID = originalEnv;
    });
  });
});
