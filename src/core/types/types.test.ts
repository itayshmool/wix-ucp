/**
 * Core Types Tests
 * 
 * Tests for UCP type definitions and the UCPException class.
 */

import { describe, it, expect } from 'vitest';
import {
  UCPErrorStatusMap,
  UCPException,
  IdentityScopes,
} from './index.js';
import type {
  Money,
  Address,
  Buyer,
  LineItem,
  CheckoutStatus,
  PaymentInstrument,
  UCPErrorCode,
  Order,
} from './index.js';

describe('Core Types', () => {
  describe('UCPErrorStatusMap', () => {
    it('should map all error codes to HTTP status codes', () => {
      expect(UCPErrorStatusMap.INVALID_REQUEST).toBe(400);
      expect(UCPErrorStatusMap.INVALID_FIELD).toBe(400);
      expect(UCPErrorStatusMap.MISSING_FIELD).toBe(400);
      expect(UCPErrorStatusMap.UNAUTHORIZED).toBe(401);
      expect(UCPErrorStatusMap.FORBIDDEN).toBe(403);
      expect(UCPErrorStatusMap.NOT_FOUND).toBe(404);
      expect(UCPErrorStatusMap.CONFLICT).toBe(409);
      expect(UCPErrorStatusMap.GONE).toBe(410);
      expect(UCPErrorStatusMap.UNPROCESSABLE).toBe(422);
      expect(UCPErrorStatusMap.RATE_LIMITED).toBe(429);
      expect(UCPErrorStatusMap.INTERNAL_ERROR).toBe(500);
      expect(UCPErrorStatusMap.SERVICE_UNAVAILABLE).toBe(503);
    });
  });

  describe('UCPException', () => {
    it('should create an exception with correct properties', () => {
      const error = new UCPException('NOT_FOUND', 'Resource not found');

      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.retryable).toBe(false);
      expect(error.details).toBeUndefined();
    });

    it('should create an exception with details', () => {
      const error = new UCPException('INVALID_FIELD', 'Validation failed', {
        details: [
          { field: 'email', code: 'INVALID_FORMAT', message: 'Invalid email format' },
        ],
      });

      expect(error.details).toHaveLength(1);
      expect(error.details?.[0]?.field).toBe('email');
    });

    it('should create a retryable exception', () => {
      const error = new UCPException('RATE_LIMITED', 'Too many requests', {
        retryable: true,
        retryAfter: 60,
      });

      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBe(60);
      expect(error.statusCode).toBe(429);
    });

    it('should convert to UCP error response format', () => {
      const error = new UCPException('UNAUTHORIZED', 'Authentication required');
      const response = error.toResponse();

      expect(response).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: undefined,
          retryable: false,
          retryAfter: undefined,
        },
      });
    });

    it('should be an instance of Error', () => {
      const error = new UCPException('INTERNAL_ERROR', 'Something went wrong');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('UCPException');
    });
  });

  describe('IdentityScopes', () => {
    it('should define all identity scopes', () => {
      expect(IdentityScopes.PROFILE).toBe('profile');
      expect(IdentityScopes.EMAIL).toBe('email');
      expect(IdentityScopes.PHONE).toBe('phone');
      expect(IdentityScopes.ADDRESS).toBe('address');
      expect(IdentityScopes.ORDERS_READ).toBe('orders:read');
      expect(IdentityScopes.ORDERS_WRITE).toBe('orders:write');
      expect(IdentityScopes.OFFLINE_ACCESS).toBe('offline_access');
    });
  });

  describe('Type Guards (compile-time checks)', () => {
    it('should allow valid Money type', () => {
      const money: Money = {
        amount: 1000,
        currency: 'USD',
      };

      expect(money.amount).toBe(1000);
      expect(money.currency).toBe('USD');
    });

    it('should allow valid Address type', () => {
      const address: Address = {
        line1: '123 Main St',
        city: 'New York',
        postalCode: '10001',
        country: 'US',
      };

      expect(address.line1).toBe('123 Main St');
      expect(address.line2).toBeUndefined();
    });

    it('should allow valid Buyer type', () => {
      const buyer: Buyer = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      expect(buyer.email).toBe('test@example.com');
    });

    it('should allow valid LineItem type', () => {
      const lineItem: LineItem = {
        id: 'li-1',
        item: {
          id: 'prod-1',
          title: 'Test Product',
          price: 1000,
        },
        quantity: 2,
        totalPrice: 2000,
      };

      expect(lineItem.totalPrice).toBe(2000);
    });

    it('should allow valid CheckoutStatus type', () => {
      const statuses: CheckoutStatus[] = [
        'incomplete',
        'ready_for_payment',
        'ready_for_complete',
        'requires_action',
        'completed',
        'expired',
        'cancelled',
      ];

      expect(statuses).toHaveLength(7);
    });

    it('should allow valid PaymentInstrument type', () => {
      const instrument: PaymentInstrument = {
        id: 'instr-1',
        type: 'card',
        brand: 'VISA',
        lastDigits: '4242',
        expiryMonth: '12',
        expiryYear: '2025',
        credential: {
          type: 'token',
          token: 'tok_xxx',
        },
      };

      expect(instrument.type).toBe('card');
    });

    it('should allow valid UCPErrorCode type', () => {
      const codes: UCPErrorCode[] = [
        'INVALID_REQUEST',
        'UNAUTHORIZED',
        'NOT_FOUND',
        'INTERNAL_ERROR',
      ];

      expect(codes).toContain('NOT_FOUND');
    });

    it('should allow valid Order type', () => {
      const order: Order = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        status: 'APPROVED',
        paymentStatus: 'PAID',
        fulfillmentStatus: 'NOT_FULFILLED',
        currency: 'USD',
        buyer: { email: 'test@example.com' },
        lineItems: [],
        totals: [],
        createdAt: '2026-01-13T00:00:00Z',
        updatedAt: '2026-01-13T00:00:00Z',
      };

      expect(order.status).toBe('APPROVED');
    });
  });
});
