/**
 * Constants Tests
 * 
 * Tests for UCP protocol constants.
 */

import { describe, it, expect } from 'vitest';
import {
  UCP_VERSION,
  UCP_SPEC_URL,
  UCP_PROTOCOL,
  HANDLER_NAME,
  SUPPORTED_CURRENCIES,
  SUPPORTED_CARD_NETWORKS,
  TTL,
  HTTP_STATUS,
  RATE_LIMITS,
  CHECKOUT_STATUSES,
  CHECKOUT_TRANSITIONS,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  LIMITS,
  API_PATHS,
  ERROR_MESSAGES,
} from './constants.js';

describe('Constants', () => {
  describe('UCP Protocol', () => {
    it('should have correct version format', () => {
      expect(UCP_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should have valid spec URL', () => {
      expect(UCP_SPEC_URL).toMatch(/^https:\/\//);
    });

    it('should have protocol object with version and spec', () => {
      expect(UCP_PROTOCOL.version).toBe(UCP_VERSION);
      expect(UCP_PROTOCOL.spec).toBe(UCP_SPEC_URL);
    });
  });

  describe('Handler', () => {
    it('should have handler name', () => {
      expect(HANDLER_NAME).toBe('com.wix.payments');
    });
  });

  describe('Supported Values', () => {
    it('should have supported currencies', () => {
      expect(SUPPORTED_CURRENCIES).toContain('USD');
      expect(SUPPORTED_CURRENCIES).toContain('EUR');
      expect(SUPPORTED_CURRENCIES).toContain('ILS');
      expect(SUPPORTED_CURRENCIES.length).toBeGreaterThan(5);
    });

    it('should have supported card networks', () => {
      expect(SUPPORTED_CARD_NETWORKS).toContain('VISA');
      expect(SUPPORTED_CARD_NETWORKS).toContain('MASTERCARD');
      expect(SUPPORTED_CARD_NETWORKS).toContain('AMEX');
    });
  });

  describe('TTL Values', () => {
    it('should have positive TTL values', () => {
      expect(TTL.TOKEN).toBeGreaterThan(0);
      expect(TTL.CHECKOUT).toBeGreaterThan(0);
      expect(TTL.MCP_SESSION).toBeGreaterThan(0);
    });

    it('should have token TTL shorter than checkout TTL', () => {
      expect(TTL.TOKEN).toBeLessThan(TTL.CHECKOUT);
    });

    it('should have access token TTL shorter than refresh token TTL', () => {
      expect(TTL.ACCESS_TOKEN).toBeLessThan(TTL.REFRESH_TOKEN);
    });
  });

  describe('HTTP Status', () => {
    it('should have standard status codes', () => {
      expect(HTTP_STATUS.OK).toBe(200);
      expect(HTTP_STATUS.CREATED).toBe(201);
      expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
      expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
      expect(HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
    });
  });

  describe('Rate Limits', () => {
    it('should have default rate limit', () => {
      expect(RATE_LIMITS.DEFAULT.max).toBeGreaterThan(0);
      expect(RATE_LIMITS.DEFAULT.timeWindow).toBeTruthy();
    });

    it('should have tokenize rate limit lower than default', () => {
      expect(RATE_LIMITS.TOKENIZE.max).toBeLessThan(RATE_LIMITS.DEFAULT.max);
    });
  });

  describe('Checkout Statuses', () => {
    it('should have all checkout statuses', () => {
      expect(CHECKOUT_STATUSES).toContain('incomplete');
      expect(CHECKOUT_STATUSES).toContain('ready_for_payment');
      expect(CHECKOUT_STATUSES).toContain('completed');
      expect(CHECKOUT_STATUSES).toContain('cancelled');
    });

    it('should have valid transitions', () => {
      expect(CHECKOUT_TRANSITIONS['incomplete']).toContain('ready_for_payment');
      expect(CHECKOUT_TRANSITIONS['completed']).toEqual([]);
    });
  });

  describe('Order Statuses', () => {
    it('should have all order statuses', () => {
      expect(ORDER_STATUSES).toContain('PENDING');
      expect(ORDER_STATUSES).toContain('APPROVED');
      expect(ORDER_STATUSES).toContain('COMPLETED');
      expect(ORDER_STATUSES).toContain('REFUNDED');
    });

    it('should have valid transitions', () => {
      expect(ORDER_TRANSITIONS['PENDING']).toContain('APPROVED');
      expect(ORDER_TRANSITIONS['COMPLETED']).toContain('REFUNDED');
      expect(ORDER_TRANSITIONS['REFUNDED']).toEqual([]);
    });
  });

  describe('Limits', () => {
    it('should have reasonable limits', () => {
      expect(LIMITS.MAX_LINE_ITEMS).toBeGreaterThan(0);
      expect(LIMITS.MAX_QUANTITY).toBeGreaterThan(0);
      expect(LIMITS.DEFAULT_PAGE_SIZE).toBeLessThanOrEqual(LIMITS.MAX_ORDER_RESULTS);
    });
  });

  describe('API Paths', () => {
    it('should have correct path prefixes', () => {
      expect(API_PATHS.UCP).toBe('/ucp/v1');
      expect(API_PATHS.DISCOVERY).toBe('/.well-known/ucp');
      expect(API_PATHS.HEALTH).toBe('/health');
    });
  });

  describe('Error Messages', () => {
    it('should have error messages for common cases', () => {
      expect(ERROR_MESSAGES.CHECKOUT_NOT_FOUND).toBeTruthy();
      expect(ERROR_MESSAGES.TOKEN_EXPIRED).toBeTruthy();
      expect(ERROR_MESSAGES.UNAUTHORIZED).toBeTruthy();
    });
  });
});
