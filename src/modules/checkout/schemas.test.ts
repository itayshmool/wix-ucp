/**
 * Checkout Schemas Tests
 * 
 * Unit tests for Zod validation schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  CreateCheckoutSchema,
  UpdateCheckoutSchema,
  CompleteCheckoutSchema,
  CheckoutIdParamSchema,
  CatalogReferenceSchema,
  LineItemInputSchema,
} from './schemas.js';

describe('Checkout Schemas', () => {
  describe('CatalogReferenceSchema', () => {
    it('should validate valid catalog reference', () => {
      const data = {
        catalogItemId: 'prod_123',
        appId: '215238eb-22a5-4c36-9e7b-e7c08025e04e',
      };

      const result = CatalogReferenceSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should validate with options', () => {
      const data = {
        catalogItemId: 'prod_123',
        appId: '215238eb-22a5-4c36-9e7b-e7c08025e04e',
        options: {
          variantId: 'var_456',
          customTextFields: { engraving: 'John' },
        },
      };

      const result = CatalogReferenceSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject empty catalogItemId', () => {
      const data = {
        catalogItemId: '',
        appId: '215238eb-22a5-4c36-9e7b-e7c08025e04e',
      };

      const result = CatalogReferenceSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('LineItemInputSchema', () => {
    it('should validate valid line item', () => {
      const data = {
        catalogReference: {
          catalogItemId: 'prod_123',
          appId: '215238eb-22a5-4c36-9e7b-e7c08025e04e',
        },
        quantity: 2,
      };

      const result = LineItemInputSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject zero quantity', () => {
      const data = {
        catalogReference: {
          catalogItemId: 'prod_123',
          appId: 'app_123',
        },
        quantity: 0,
      };

      const result = LineItemInputSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject negative quantity', () => {
      const data = {
        catalogReference: {
          catalogItemId: 'prod_123',
          appId: 'app_123',
        },
        quantity: -1,
      };

      const result = LineItemInputSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('CreateCheckoutSchema', () => {
    it('should validate minimal checkout request', () => {
      const data = {
        currency: 'usd',
        lineItems: [
          {
            catalogReference: {
              catalogItemId: 'prod_123',
              appId: 'app_123',
            },
            quantity: 1,
          },
        ],
      };

      const result = CreateCheckoutSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currency).toBe('USD'); // Uppercased
      }
    });

    it('should validate full checkout request', () => {
      const data = {
        currency: 'USD',
        buyer: {
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
        },
        lineItems: [
          {
            catalogReference: {
              catalogItemId: 'prod_123',
              appId: 'app_123',
            },
            quantity: 2,
          },
        ],
        shippingAddress: {
          line1: '123 Main St',
          city: 'New York',
          country: 'US',
          postalCode: '10001',
        },
        discountCode: 'SAVE10',
        metadata: { source: 'web' },
      };

      const result = CreateCheckoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid currency', () => {
      const data = {
        currency: 'USDD',
        lineItems: [
          {
            catalogReference: { catalogItemId: 'p1', appId: 'a1' },
            quantity: 1,
          },
        ],
      };

      const result = CreateCheckoutSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject empty line items', () => {
      const data = {
        currency: 'USD',
        lineItems: [],
      };

      const result = CreateCheckoutSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid buyer email', () => {
      const data = {
        currency: 'USD',
        buyer: { email: 'not-an-email' },
        lineItems: [
          {
            catalogReference: { catalogItemId: 'p1', appId: 'a1' },
            quantity: 1,
          },
        ],
      };

      const result = CreateCheckoutSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateCheckoutSchema', () => {
    it('should validate buyer update', () => {
      const data = {
        buyer: {
          email: 'new@example.com',
        },
      };

      const result = UpdateCheckoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should validate shipping address update', () => {
      const data = {
        shippingAddress: {
          line1: '456 Oak Ave',
          city: 'Los Angeles',
          country: 'US',
          postalCode: '90001',
        },
      };

      const result = UpdateCheckoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should validate fulfillment selection', () => {
      const data = {
        selectedFulfillment: 'express_shipping',
      };

      const result = UpdateCheckoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should validate discount code removal', () => {
      const data = {
        discountCode: null,
      };

      const result = UpdateCheckoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject empty update', () => {
      const data = {};

      const result = UpdateCheckoutSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('CompleteCheckoutSchema', () => {
    it('should validate complete request', () => {
      const data = {
        paymentData: {
          id: 'pi_123',
          handlerId: 'com.wix.payments',
          credential: {
            type: 'token',
            token: 'tok_abc123',
          },
        },
        idempotencyKey: 'idem_xyz789',
      };

      const result = CompleteCheckoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should validate with billing address', () => {
      const data = {
        paymentData: {
          id: 'pi_123',
          handlerId: 'com.wix.payments',
          credential: {
            type: 'token',
            token: 'tok_abc123',
          },
          billingAddress: {
            line1: '123 Main St',
            city: 'NYC',
            country: 'US',
            postalCode: '10001',
          },
        },
        idempotencyKey: 'idem_xyz789',
      };

      const result = CompleteCheckoutSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject missing token', () => {
      const data = {
        paymentData: {
          id: 'pi_123',
          handlerId: 'com.wix.payments',
          credential: {
            type: 'token',
            token: '',
          },
        },
        idempotencyKey: 'idem_xyz789',
      };

      const result = CompleteCheckoutSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject missing idempotency key', () => {
      const data = {
        paymentData: {
          id: 'pi_123',
          handlerId: 'com.wix.payments',
          credential: {
            type: 'token',
            token: 'tok_abc',
          },
        },
        idempotencyKey: '',
      };

      const result = CompleteCheckoutSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject too long idempotency key', () => {
      const data = {
        paymentData: {
          id: 'pi_123',
          handlerId: 'com.wix.payments',
          credential: {
            type: 'token',
            token: 'tok_abc',
          },
        },
        idempotencyKey: 'a'.repeat(65),
      };

      const result = CompleteCheckoutSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('CheckoutIdParamSchema', () => {
    it('should validate correct checkout ID format', () => {
      const data = { checkoutId: 'chk_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4' };

      const result = CheckoutIdParamSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid prefix', () => {
      const data = { checkoutId: 'xyz_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4' };

      const result = CheckoutIdParamSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject wrong length', () => {
      const data = { checkoutId: 'chk_short' };

      const result = CheckoutIdParamSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject uppercase hex', () => {
      const data = { checkoutId: 'chk_A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4' };

      const result = CheckoutIdParamSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });
});
