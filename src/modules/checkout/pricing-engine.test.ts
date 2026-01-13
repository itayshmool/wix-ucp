/**
 * Pricing Engine Tests
 * 
 * Unit tests for checkout totals calculation.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSubtotal,
  calculateDiscountAmount,
  calculateTax,
  calculateTotals,
  totalsBreakdownToUCP,
  recalculateTotals,
  validateDiscountCode,
  formatAmount,
  getTotalByType,
  getGrandTotal,
} from './pricing-engine.js';
import type { LineItem } from '../../core/types/ucp-common.js';
import type { FulfillmentOption, DiscountInfo } from './types.js';

describe('Pricing Engine', () => {
  const sampleLineItems: LineItem[] = [
    {
      id: 'li_1',
      item: { id: 'p1', title: 'Product 1', price: 2500 },
      quantity: 2,
      totalPrice: 5000,
    },
    {
      id: 'li_2',
      item: { id: 'p2', title: 'Product 2', price: 1500 },
      quantity: 1,
      totalPrice: 1500,
    },
  ];

  describe('calculateSubtotal', () => {
    it('should sum line item totals', () => {
      const subtotal = calculateSubtotal(sampleLineItems);
      expect(subtotal).toBe(6500); // $65.00
    });

    it('should handle zero totalPrice by using it as-is', () => {
      // Note: The implementation uses totalPrice directly, even if 0
      // This test documents that behavior
      const items: LineItem[] = [
        {
          id: 'li_1',
          item: { id: 'p1', title: 'Product', price: 1000 },
          quantity: 3,
          totalPrice: 0, // Zero totalPrice
        },
      ];

      const subtotal = calculateSubtotal(items);
      expect(subtotal).toBe(0); // Uses totalPrice directly
    });

    it('should return 0 for empty items', () => {
      expect(calculateSubtotal([])).toBe(0);
    });
  });

  describe('calculateDiscountAmount', () => {
    it('should calculate percentage discount', () => {
      const discount: DiscountInfo = {
        code: 'SAVE10',
        name: '10% Off',
        type: 'percentage',
        value: 10,
      };

      const amount = calculateDiscountAmount(10000, discount);
      expect(amount).toBe(1000); // 10% of $100
    });

    it('should calculate fixed discount', () => {
      const discount: DiscountInfo = {
        code: 'FLAT20',
        name: '$20 Off',
        type: 'fixed',
        value: 2000,
      };

      const amount = calculateDiscountAmount(10000, discount);
      expect(amount).toBe(2000);
    });

    it('should cap fixed discount at subtotal', () => {
      const discount: DiscountInfo = {
        code: 'HUGE',
        name: '$100 Off',
        type: 'fixed',
        value: 10000,
      };

      const amount = calculateDiscountAmount(5000, discount);
      expect(amount).toBe(5000); // Capped at subtotal
    });

    it('should return 0 for no discount', () => {
      expect(calculateDiscountAmount(10000, undefined)).toBe(0);
    });
  });

  describe('calculateTax', () => {
    it('should calculate tax at rate', () => {
      const tax = calculateTax(10000, 0.08);
      expect(tax).toBe(800); // 8% of $100
    });

    it('should round to nearest cent', () => {
      const tax = calculateTax(3333, 0.07);
      expect(tax).toBe(233); // Rounded
    });

    it('should return 0 for zero rate', () => {
      expect(calculateTax(10000, 0)).toBe(0);
    });
  });

  describe('calculateTotals', () => {
    it('should calculate complete breakdown', () => {
      const shippingOption: FulfillmentOption = {
        id: 'ship_1',
        type: 'shipping',
        title: 'Standard',
        price: 599,
      };

      const discount: DiscountInfo = {
        code: 'SAVE10',
        name: '10% Off',
        type: 'percentage',
        value: 10,
      };

      const breakdown = calculateTotals(sampleLineItems, {
        shippingOption,
        taxRate: 0.08,
        discount,
      });

      expect(breakdown.subtotal).toBe(6500);
      expect(breakdown.discount).toBe(650); // 10% of 6500
      expect(breakdown.shipping).toBe(599);
      // Tax on (6500 - 650 + 599) = 6449 * 0.08 = 515.92 → 516
      expect(breakdown.tax).toBe(516);
      // Total: 6500 - 650 + 599 + 516 = 6965
      expect(breakdown.total).toBe(6965);
    });

    it('should handle no options', () => {
      const breakdown = calculateTotals(sampleLineItems);

      expect(breakdown.subtotal).toBe(6500);
      expect(breakdown.shipping).toBe(0);
      expect(breakdown.tax).toBe(0);
      expect(breakdown.discount).toBe(0);
      expect(breakdown.total).toBe(6500);
    });

    it('should never return negative total', () => {
      const discount: DiscountInfo = {
        code: 'HUGE',
        name: 'Massive Discount',
        type: 'fixed',
        value: 100000,
      };

      const breakdown = calculateTotals(sampleLineItems, { discount });

      expect(breakdown.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('totalsBreakdownToUCP', () => {
    it('should convert breakdown to UCP totals', () => {
      const breakdown = {
        subtotal: 6500,
        shipping: 599,
        tax: 516,
        discount: 650,
        total: 6965,
      };

      const totals = totalsBreakdownToUCP(breakdown);

      expect(totals).toHaveLength(5);
      expect(totals.find((t) => t.type === 'SUBTOTAL')?.amount).toBe(6500);
      expect(totals.find((t) => t.type === 'SHIPPING')?.amount).toBe(599);
      expect(totals.find((t) => t.type === 'TAX')?.amount).toBe(516);
      expect(totals.find((t) => t.type === 'DISCOUNT')?.amount).toBe(-650);
      expect(totals.find((t) => t.type === 'TOTAL')?.amount).toBe(6965);
    });

    it('should use custom labels', () => {
      const breakdown = {
        subtotal: 5000,
        shipping: 0,
        tax: 0,
        discount: 500,
        total: 4500,
      };

      const totals = totalsBreakdownToUCP(breakdown, {
        discountLabel: 'Promo: SAVE10',
      });

      expect(totals.find((t) => t.type === 'DISCOUNT')?.label).toBe('Promo: SAVE10');
    });

    it('should omit zero shipping and tax', () => {
      const breakdown = {
        subtotal: 5000,
        shipping: 0,
        tax: 0,
        discount: 0,
        total: 5000,
      };

      const totals = totalsBreakdownToUCP(breakdown);

      expect(totals.find((t) => t.type === 'SHIPPING')).toBeUndefined();
      expect(totals.find((t) => t.type === 'TAX')).toBeUndefined();
      expect(totals.find((t) => t.type === 'DISCOUNT')).toBeUndefined();
    });
  });

  describe('recalculateTotals', () => {
    it('should recalculate and return UCP totals', () => {
      const shippingOption: FulfillmentOption = {
        id: 'ship_1',
        type: 'shipping',
        title: 'Express Shipping',
        price: 1299,
      };

      const totals = recalculateTotals(sampleLineItems, shippingOption);

      expect(totals.find((t) => t.type === 'SUBTOTAL')?.amount).toBe(6500);
      expect(totals.find((t) => t.type === 'SHIPPING')?.amount).toBe(1299);
      expect(totals.find((t) => t.type === 'SHIPPING')?.label).toBe('Express Shipping');
    });
  });

  describe('validateDiscountCode', () => {
    it('should validate TEST10 code', async () => {
      const discount = await validateDiscountCode('TEST10', 5000);

      expect(discount).not.toBeNull();
      expect(discount?.code).toBe('TEST10');
      expect(discount?.type).toBe('percentage');
      expect(discount?.value).toBe(10);
    });

    it('should validate FLAT20 code', async () => {
      const discount = await validateDiscountCode('FLAT20', 5000);

      expect(discount).not.toBeNull();
      expect(discount?.code).toBe('FLAT20');
      expect(discount?.type).toBe('fixed');
      expect(discount?.value).toBe(2000);
    });

    it('should return null for invalid code', async () => {
      const discount = await validateDiscountCode('INVALID', 5000);
      expect(discount).toBeNull();
    });
  });

  describe('formatAmount', () => {
    it('should format USD amount', () => {
      const formatted = formatAmount(2599, 'USD');
      expect(formatted).toBe('$25.99');
    });

    it('should format EUR amount', () => {
      const formatted = formatAmount(1000, 'EUR');
      expect(formatted).toContain('10');
    });
  });

  describe('getTotalByType', () => {
    const totals = [
      { type: 'SUBTOTAL' as const, label: 'Subtotal', amount: 5000 },
      { type: 'TOTAL' as const, label: 'Total', amount: 5500 },
    ];

    it('should find total by type', () => {
      const subtotal = getTotalByType(totals, 'SUBTOTAL');
      expect(subtotal?.amount).toBe(5000);
    });

    it('should return undefined for missing type', () => {
      const shipping = getTotalByType(totals, 'SHIPPING');
      expect(shipping).toBeUndefined();
    });
  });

  describe('getGrandTotal', () => {
    it('should return total amount', () => {
      const totals = [
        { type: 'SUBTOTAL' as const, label: 'Subtotal', amount: 5000 },
        { type: 'TOTAL' as const, label: 'Total', amount: 5500 },
      ];

      expect(getGrandTotal(totals)).toBe(5500);
    });

    it('should return 0 for missing total', () => {
      const totals = [
        { type: 'SUBTOTAL' as const, label: 'Subtotal', amount: 5000 },
      ];

      expect(getGrandTotal(totals)).toBe(0);
    });
  });
});
