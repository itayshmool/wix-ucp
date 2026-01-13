/**
 * Cart Mapper Tests
 * 
 * Unit tests for Wix to UCP mapping functions.
 */

import { describe, it, expect } from 'vitest';
import {
  mapWixLineItemsToUCP,
  mapWixBuyerToUCP,
  mapWixTotalsToUCP,
  mapWixStatusToUCP,
  generateMessages,
  generateLinks,
  buildUCPHeader,
  hasPhysicalItems,
  calculateExpiry,
} from './cart-mapper.js';
import type { WixLineItem, WixPriceSummary, WixCheckout } from '../../adapters/wix/types.js';
import type { LineItem } from '../../core/types/ucp-common.js';

describe('Cart Mapper', () => {
  describe('mapWixLineItemsToUCP', () => {
    it('should map Wix line items to UCP format', () => {
      const wixLineItems: WixLineItem[] = [
        {
          id: 'li_1',
          productName: 'Test Product',
          quantity: 2,
          price: '25.00',
          totalPrice: '50.00',
          catalogReference: {
            catalogItemId: 'prod_123',
            appId: '215238eb-22a5-4c36-9e7b-e7c08025e04e',
          },
          image: {
            url: 'https://example.com/image.jpg',
          },
          descriptionLines: ['Color: Red', 'Size: M'],
        },
      ];

      const result = mapWixLineItemsToUCP(wixLineItems);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('li_1');
      expect(result[0].item.id).toBe('prod_123');
      expect(result[0].item.title).toBe('Test Product');
      expect(result[0].item.description).toBe('Color: Red Size: M');
      expect(result[0].item.price).toBe(2500); // Minor units
      expect(result[0].item.imageUrl).toBe('https://example.com/image.jpg');
      expect(result[0].quantity).toBe(2);
      expect(result[0].totalPrice).toBe(5000);
    });

    it('should handle missing optional fields', () => {
      const wixLineItems: WixLineItem[] = [
        {
          id: 'li_1',
          productName: 'Simple Product',
          quantity: 1,
          price: '10.00',
          totalPrice: '10.00',
        },
      ];

      const result = mapWixLineItemsToUCP(wixLineItems);

      expect(result[0].item.id).toBe('li_1'); // Falls back to line item ID
      expect(result[0].item.description).toBeUndefined();
      expect(result[0].item.imageUrl).toBeUndefined();
    });

    it('should handle numeric prices', () => {
      const wixLineItems: WixLineItem[] = [
        {
          id: 'li_1',
          productName: 'Numeric Price Product',
          quantity: 1,
          price: 15.50 as unknown as string,
          totalPrice: 15.50 as unknown as string,
        },
      ];

      const result = mapWixLineItemsToUCP(wixLineItems);

      expect(result[0].item.price).toBe(1550);
      expect(result[0].totalPrice).toBe(1550);
    });
  });

  describe('mapWixBuyerToUCP', () => {
    it('should map buyer info with all fields', () => {
      const buyerInfo = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
      };

      const result = mapWixBuyerToUCP(buyerInfo);

      expect(result).toEqual({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
      });
    });

    it('should return undefined for missing email', () => {
      const result = mapWixBuyerToUCP({ firstName: 'John' });
      expect(result).toBeUndefined();
    });

    it('should return undefined for undefined input', () => {
      const result = mapWixBuyerToUCP(undefined);
      expect(result).toBeUndefined();
    });
  });

  describe('mapWixTotalsToUCP', () => {
    it('should map full price summary', () => {
      const priceSummary: WixPriceSummary = {
        subtotal: '50.00',
        shipping: '5.99',
        tax: '4.48',
        discount: '10.00',
        total: '50.47',
      };

      const result = mapWixTotalsToUCP(priceSummary, 'USD');

      expect(result).toHaveLength(5);
      expect(result.find((t) => t.type === 'SUBTOTAL')?.amount).toBe(5000);
      expect(result.find((t) => t.type === 'SHIPPING')?.amount).toBe(599);
      expect(result.find((t) => t.type === 'TAX')?.amount).toBe(448);
      expect(result.find((t) => t.type === 'DISCOUNT')?.amount).toBe(-1000);
      expect(result.find((t) => t.type === 'TOTAL')?.amount).toBe(5047);
    });

    it('should omit zero values except subtotal and total', () => {
      const priceSummary: WixPriceSummary = {
        subtotal: '50.00',
        total: '50.00',
      };

      const result = mapWixTotalsToUCP(priceSummary, 'USD');

      expect(result).toHaveLength(2);
      expect(result.find((t) => t.type === 'SUBTOTAL')).toBeDefined();
      expect(result.find((t) => t.type === 'TOTAL')).toBeDefined();
      expect(result.find((t) => t.type === 'SHIPPING')).toBeUndefined();
    });
  });

  describe('mapWixStatusToUCP', () => {
    it('should return incomplete when missing buyer', () => {
      const checkout: WixCheckout = {
        id: 'chk_1',
        cartId: 'cart_1',
        lineItems: [],
        priceSummary: { subtotal: '0', total: '0' },
        currency: 'USD',
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString(),
      };

      expect(mapWixStatusToUCP(checkout)).toBe('incomplete');
    });

    it('should return incomplete when missing shipping', () => {
      const checkout: WixCheckout = {
        id: 'chk_1',
        cartId: 'cart_1',
        buyerInfo: { email: 'test@example.com' },
        lineItems: [],
        priceSummary: { subtotal: '0', total: '0' },
        currency: 'USD',
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString(),
      };

      expect(mapWixStatusToUCP(checkout)).toBe('incomplete');
    });

    it('should return ready_for_payment when complete', () => {
      const checkout: WixCheckout = {
        id: 'chk_1',
        cartId: 'cart_1',
        buyerInfo: { email: 'test@example.com' },
        lineItems: [],
        shippingInfo: {
          shippingDestination: {
            address: { city: 'NYC', country: 'US', postalCode: '10001' },
          },
        },
        priceSummary: { subtotal: '0', total: '0' },
        currency: 'USD',
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString(),
      };

      expect(mapWixStatusToUCP(checkout)).toBe('ready_for_payment');
    });
  });

  describe('generateMessages', () => {
    it('should generate warning for missing email', () => {
      const messages = generateMessages(undefined, true, undefined, undefined);

      expect(messages).toContainEqual(
        expect.objectContaining({
          type: 'warning',
          code: 'MISSING_EMAIL',
        })
      );
    });

    it('should generate warning for missing shipping', () => {
      const buyer = { email: 'test@example.com' };
      const messages = generateMessages(buyer, true, undefined, undefined);

      expect(messages).toContainEqual(
        expect.objectContaining({
          type: 'warning',
          code: 'MISSING_SHIPPING',
        })
      );
    });

    it('should generate info for discount applied', () => {
      const buyer = { email: 'test@example.com' };
      const address = { line1: '123 Main', city: 'NYC', country: 'US', postalCode: '10001' };
      const messages = generateMessages(buyer, true, 'ship_1', address, true);

      expect(messages).toContainEqual(
        expect.objectContaining({
          type: 'info',
          code: 'DISCOUNT_APPLIED',
        })
      );
    });

    it('should return empty for complete checkout without discount', () => {
      const buyer = { email: 'test@example.com' };
      const address = { line1: '123 Main', city: 'NYC', country: 'US', postalCode: '10001' };
      const messages = generateMessages(buyer, true, 'ship_1', address, false);

      expect(messages).toHaveLength(0);
    });
  });

  describe('generateLinks', () => {
    it('should generate HATEOAS links', () => {
      const links = generateLinks('chk_123');

      expect(links).toContainEqual({ rel: 'self', href: expect.stringContaining('/chk_123'), method: 'GET' });
      expect(links).toContainEqual({ rel: 'update', href: expect.stringContaining('/chk_123'), method: 'PATCH' });
      expect(links).toContainEqual({ rel: 'complete', href: expect.stringContaining('/chk_123/complete'), method: 'POST' });
      expect(links).toContainEqual({ rel: 'cancel', href: expect.stringContaining('/chk_123'), method: 'DELETE' });
    });

    it('should use custom base URL', () => {
      const links = generateLinks('chk_123', 'https://api.example.com');

      expect(links[0].href.startsWith('https://api.example.com')).toBe(true);
    });
  });

  describe('buildUCPHeader', () => {
    it('should build UCP version header', () => {
      const header = buildUCPHeader();

      expect(header.version).toBe('2026-01-11');
      expect(header.services['dev.ucp.shopping']).toBeDefined();
      expect(header.services['dev.ucp.shopping'].version).toBeDefined();
      expect(header.services['dev.ucp.shopping'].spec).toBeDefined();
    });
  });

  describe('hasPhysicalItems', () => {
    it('should return true for physical items', () => {
      const lineItems: LineItem[] = [
        {
          id: 'li_1',
          item: { id: 'p1', title: 'Physical', price: 1000 },
          quantity: 1,
          totalPrice: 1000,
        },
      ];

      expect(hasPhysicalItems(lineItems)).toBe(true);
    });

    it('should return true for items without type (default physical)', () => {
      const lineItems: LineItem[] = [
        {
          id: 'li_1',
          item: { id: 'p1', title: 'No Type', price: 1000 },
          quantity: 1,
          totalPrice: 1000,
        },
      ];

      expect(hasPhysicalItems(lineItems)).toBe(true);
    });

    it('should return false for digital-only items', () => {
      const lineItems: LineItem[] = [
        {
          id: 'li_1',
          item: { id: 'd1', title: 'Digital', price: 500, type: 'digital' },
          quantity: 1,
          totalPrice: 500,
        },
      ];

      expect(hasPhysicalItems(lineItems)).toBe(false);
    });
  });

  describe('calculateExpiry', () => {
    it('should calculate future expiry time', () => {
      const expiry = calculateExpiry(3600);
      const expiryDate = new Date(expiry);
      const now = new Date();

      expect(expiryDate.getTime()).toBeGreaterThan(now.getTime());
      expect(expiryDate.getTime()).toBeLessThanOrEqual(now.getTime() + 3600 * 1000 + 1000);
    });

    it('should use default TTL', () => {
      const expiry = calculateExpiry();
      const expiryDate = new Date(expiry);
      const now = new Date();

      // Default is 1 hour
      expect(expiryDate.getTime() - now.getTime()).toBeLessThanOrEqual(3600 * 1000 + 1000);
    });
  });
});
