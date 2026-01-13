/**
 * Schema Validation Tests
 * 
 * Tests for all Zod validation schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  MoneySchema,
  AddressSchema,
  BuyerSchema,
  LineItemSchema,
  CreateCheckoutRequestSchema,
  UpdateCheckoutRequestSchema,
  CompleteCheckoutRequestSchema,
  TokenizeRequestSchema,
  DetokenizeRequestSchema,
  CardNumberSchema,
  CVVSchema,
  ExpiryMonthSchema,
  ExpiryYearSchema,
  AuthorizeRequestSchema,
  TokenRequestSchema,
  ListOrdersRequestSchema,
  ReturnRequestSchema,
} from './index.js';

describe('Common Schemas', () => {
  describe('MoneySchema', () => {
    it('should validate valid money', () => {
      const result = MoneySchema.safeParse({ amount: 1000, currency: 'usd' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currency).toBe('USD'); // Transformed to uppercase
      }
    });

    it('should reject negative amount', () => {
      const result = MoneySchema.safeParse({ amount: -100, currency: 'USD' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid currency length', () => {
      const result = MoneySchema.safeParse({ amount: 100, currency: 'US' });
      expect(result.success).toBe(false);
    });
  });

  describe('AddressSchema', () => {
    it('should validate valid address', () => {
      const result = AddressSchema.safeParse({
        line1: '123 Main St',
        city: 'New York',
        postalCode: '10001',
        country: 'us',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.country).toBe('US');
      }
    });

    it('should allow optional fields', () => {
      const result = AddressSchema.safeParse({
        line1: '123 Main St',
        line2: 'Apt 4B',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'US',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const result = AddressSchema.safeParse({
        city: 'New York',
        country: 'US',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('BuyerSchema', () => {
    it('should validate valid buyer', () => {
      const result = BuyerSchema.safeParse({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = BuyerSchema.safeParse({
        email: 'not-an-email',
      });
      expect(result.success).toBe(false);
    });

    it('should validate phone number', () => {
      const result = BuyerSchema.safeParse({
        email: 'test@example.com',
        phone: '+1-555-123-4567',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('LineItemSchema', () => {
    it('should validate valid line item', () => {
      const result = LineItemSchema.safeParse({
        id: 'li-1',
        item: {
          id: 'prod-1',
          title: 'Test Product',
          price: 1000,
        },
        quantity: 2,
        totalPrice: 2000,
      });
      expect(result.success).toBe(true);
    });

    it('should reject zero quantity', () => {
      const result = LineItemSchema.safeParse({
        id: 'li-1',
        item: { id: 'prod-1', title: 'Test', price: 100 },
        quantity: 0,
        totalPrice: 0,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Checkout Schemas', () => {
  describe('CreateCheckoutRequestSchema', () => {
    it('should validate valid create request', () => {
      const result = CreateCheckoutRequestSchema.safeParse({
        currency: 'usd',
        lineItems: [{ itemId: 'prod-1', quantity: 2 }],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currency).toBe('USD');
      }
    });

    it('should validate with buyer', () => {
      const result = CreateCheckoutRequestSchema.safeParse({
        currency: 'USD',
        buyer: { email: 'test@example.com' },
        lineItems: [{ itemId: 'prod-1', quantity: 1 }],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty line items', () => {
      const result = CreateCheckoutRequestSchema.safeParse({
        currency: 'USD',
        lineItems: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateCheckoutRequestSchema', () => {
    it('should validate buyer update', () => {
      const result = UpdateCheckoutRequestSchema.safeParse({
        buyer: { firstName: 'John' },
      });
      expect(result.success).toBe(true);
    });

    it('should validate fulfillment selection', () => {
      const result = UpdateCheckoutRequestSchema.safeParse({
        fulfillmentOptionId: 'shipping-standard',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty update', () => {
      const result = UpdateCheckoutRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('CompleteCheckoutRequestSchema', () => {
    it('should validate valid complete request', () => {
      const result = CompleteCheckoutRequestSchema.safeParse({
        payment: {
          handlerId: 'handler-1',
          instrumentId: 'instr-1',
          credential: {
            type: 'token',
            token: 'tok_xxx',
          },
        },
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing credential', () => {
      const result = CompleteCheckoutRequestSchema.safeParse({
        payment: {
          handlerId: 'handler-1',
          instrumentId: 'instr-1',
        },
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Payment Schemas', () => {
  describe('Card Validation', () => {
    it('should validate card number', () => {
      expect(CardNumberSchema.safeParse('4242424242424242').success).toBe(true);
      expect(CardNumberSchema.safeParse('4111111111111111').success).toBe(true);
    });

    it('should reject short card number', () => {
      expect(CardNumberSchema.safeParse('424242').success).toBe(false);
    });

    it('should reject non-numeric card', () => {
      expect(CardNumberSchema.safeParse('4242-4242-4242-4242').success).toBe(false);
    });

    it('should validate CVV', () => {
      expect(CVVSchema.safeParse('123').success).toBe(true);
      expect(CVVSchema.safeParse('1234').success).toBe(true);
    });

    it('should reject invalid CVV', () => {
      expect(CVVSchema.safeParse('12').success).toBe(false);
      expect(CVVSchema.safeParse('12345').success).toBe(false);
    });

    it('should validate expiry month', () => {
      expect(ExpiryMonthSchema.safeParse('1').success).toBe(true);
      expect(ExpiryMonthSchema.safeParse('01').success).toBe(true);
      expect(ExpiryMonthSchema.safeParse('12').success).toBe(true);
    });

    it('should reject invalid expiry month', () => {
      expect(ExpiryMonthSchema.safeParse('0').success).toBe(false);
      expect(ExpiryMonthSchema.safeParse('13').success).toBe(false);
    });

    it('should validate expiry year', () => {
      expect(ExpiryYearSchema.safeParse('25').success).toBe(true);
      expect(ExpiryYearSchema.safeParse('2025').success).toBe(true);
    });
  });

  describe('TokenizeRequestSchema', () => {
    it('should validate card tokenize request', () => {
      const result = TokenizeRequestSchema.safeParse({
        checkoutId: 'checkout-1',
        paymentMethod: {
          type: 'card',
          number: '4242424242424242',
          expiryMonth: '12',
          expiryYear: '25',
          cvv: '123',
        },
      });
      expect(result.success).toBe(true);
    });

    it('should validate external token request', () => {
      const result = TokenizeRequestSchema.safeParse({
        checkoutId: 'checkout-1',
        paymentMethod: {
          type: 'external_token',
          token: 'stripe_tok_xxx',
          provider: 'stripe',
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('DetokenizeRequestSchema', () => {
    it('should validate detokenize request', () => {
      const result = DetokenizeRequestSchema.safeParse({
        checkoutId: 'checkout-1',
        token: 'tok_xxx',
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('Identity Schemas', () => {
  describe('AuthorizeRequestSchema', () => {
    it('should validate valid authorize request', () => {
      const result = AuthorizeRequestSchema.safeParse({
        response_type: 'code',
        client_id: 'client-1',
        redirect_uri: 'https://example.com/callback',
        scope: 'profile email',
        state: 'random-state',
      });
      expect(result.success).toBe(true);
    });

    it('should validate with PKCE', () => {
      const result = AuthorizeRequestSchema.safeParse({
        response_type: 'code',
        client_id: 'client-1',
        redirect_uri: 'https://example.com/callback',
        scope: 'profile',
        state: 'random-state',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        code_challenge_method: 'S256',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('TokenRequestSchema', () => {
    it('should validate authorization code grant', () => {
      const result = TokenRequestSchema.safeParse({
        grant_type: 'authorization_code',
        code: 'auth-code-xxx',
        redirect_uri: 'https://example.com/callback',
        client_id: 'client-1',
      });
      expect(result.success).toBe(true);
    });

    it('should validate refresh token grant', () => {
      const result = TokenRequestSchema.safeParse({
        grant_type: 'refresh_token',
        refresh_token: 'refresh-xxx',
        client_id: 'client-1',
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('Order Schemas', () => {
  describe('ListOrdersRequestSchema', () => {
    it('should validate with defaults', () => {
      const result = ListOrdersRequestSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });

    it('should validate with filters', () => {
      const result = ListOrdersRequestSchema.safeParse({
        status: 'APPROVED',
        limit: 50,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('ReturnRequestSchema', () => {
    it('should validate valid return request', () => {
      const result = ReturnRequestSchema.safeParse({
        lineItems: [
          { lineItemId: 'li-1', quantity: 1, reason: 'DAMAGED' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should validate with note', () => {
      const result = ReturnRequestSchema.safeParse({
        lineItems: [
          { lineItemId: 'li-1', quantity: 1, reason: 'OTHER', note: 'Item was wrong color' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty line items', () => {
      const result = ReturnRequestSchema.safeParse({
        lineItems: [],
      });
      expect(result.success).toBe(false);
    });
  });
});
