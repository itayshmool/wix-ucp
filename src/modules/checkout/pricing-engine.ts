/**
 * Pricing Engine
 * 
 * Calculates checkout totals including tax, shipping, and discounts.
 * See: .cursor/rules/modules/checkout.mdc
 */

import type { LineItem, Total } from '../../core/types/ucp-common.js';
import type { TotalsBreakdown, DiscountInfo, FulfillmentOption } from './types.js';

/**
 * Calculate subtotal from line items
 */
export function calculateSubtotal(lineItems: LineItem[]): number {
  return lineItems.reduce((sum, item) => {
    // Use totalPrice if available, otherwise calculate from unit price
    if (typeof item.totalPrice === 'number') {
      return sum + item.totalPrice;
    }
    return sum + (item.item.price * item.quantity);
  }, 0);
}

/**
 * Calculate discount amount
 */
export function calculateDiscountAmount(
  subtotal: number,
  discount?: DiscountInfo
): number {
  if (!discount) {
    return 0;
  }

  if (discount.type === 'percentage') {
    return Math.round(subtotal * (discount.value / 100));
  }

  // Fixed amount discount
  return Math.min(discount.value, subtotal); // Can't discount more than subtotal
}

/**
 * Calculate tax amount
 * 
 * @param taxableAmount - Amount to calculate tax on
 * @param taxRate - Tax rate as decimal (e.g., 0.08 for 8%)
 */
export function calculateTax(taxableAmount: number, taxRate: number): number {
  return Math.round(taxableAmount * taxRate);
}

/**
 * Calculate complete totals breakdown
 */
export function calculateTotals(
  lineItems: LineItem[],
  options: {
    shippingOption?: FulfillmentOption;
    taxRate?: number;
    discount?: DiscountInfo;
  } = {}
): TotalsBreakdown {
  const { shippingOption, taxRate = 0, discount } = options;

  const subtotal = calculateSubtotal(lineItems);
  const discountAmount = calculateDiscountAmount(subtotal, discount);
  const shipping = shippingOption?.price ?? 0;
  
  // Tax is calculated on subtotal minus discount, plus shipping (varies by jurisdiction)
  const taxableAmount = subtotal - discountAmount + shipping;
  const tax = calculateTax(taxableAmount, taxRate);
  
  const total = subtotal - discountAmount + shipping + tax;

  return {
    subtotal,
    shipping,
    tax,
    discount: discountAmount,
    total: Math.max(0, total), // Total can't be negative
  };
}

/**
 * Convert totals breakdown to UCP Total array
 */
export function totalsBreakdownToUCP(
  breakdown: TotalsBreakdown,
  options: {
    shippingLabel?: string;
    discountLabel?: string;
  } = {}
): Total[] {
  const { shippingLabel = 'Shipping', discountLabel = 'Discount' } = options;
  const totals: Total[] = [];

  // Always include subtotal
  totals.push({
    type: 'SUBTOTAL',
    label: 'Subtotal',
    amount: breakdown.subtotal,
  });

  // Include shipping if present
  if (breakdown.shipping > 0) {
    totals.push({
      type: 'SHIPPING',
      label: shippingLabel,
      amount: breakdown.shipping,
    });
  }

  // Include discount if present (as negative)
  if (breakdown.discount > 0) {
    totals.push({
      type: 'DISCOUNT',
      label: discountLabel,
      amount: -breakdown.discount,
    });
  }

  // Include tax if present
  if (breakdown.tax > 0) {
    totals.push({
      type: 'TAX',
      label: 'Tax',
      amount: breakdown.tax,
    });
  }

  // Always include total
  totals.push({
    type: 'TOTAL',
    label: 'Total',
    amount: breakdown.total,
  });

  return totals;
}

/**
 * Recalculate totals for a checkout session
 */
export function recalculateTotals(
  lineItems: LineItem[],
  selectedFulfillment?: FulfillmentOption,
  discount?: DiscountInfo,
  taxRate = 0
): Total[] {
  const breakdown = calculateTotals(lineItems, {
    shippingOption: selectedFulfillment,
    taxRate,
    discount,
  });

  return totalsBreakdownToUCP(breakdown, {
    shippingLabel: selectedFulfillment?.title ?? 'Shipping',
    discountLabel: discount?.name ?? 'Discount',
  });
}

/**
 * Validate discount code (stub - would integrate with Wix Coupons API)
 */
export async function validateDiscountCode(
  code: string,
  subtotal: number
): Promise<DiscountInfo | null> {
  // TODO: Integrate with Wix Coupons API
  // For now, return null (no discount)
  
  // Mock implementation for testing
  if (code === 'TEST10') {
    return {
      code: 'TEST10',
      name: '10% Off',
      type: 'percentage',
      value: 10,
    };
  }

  if (code === 'FLAT20') {
    return {
      code: 'FLAT20',
      name: '$20 Off',
      type: 'fixed',
      value: 2000, // $20 in cents
    };
  }

  return null;
}

/**
 * Format amount for display (minor units to major units)
 */
export function formatAmount(amount: number, currency = 'USD'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  });
  return formatter.format(amount / 100);
}

/**
 * Get total by type from totals array
 */
export function getTotalByType(
  totals: Total[],
  type: Total['type']
): Total | undefined {
  return totals.find((t) => t.type === type);
}

/**
 * Get grand total amount from totals array
 */
export function getGrandTotal(totals: Total[]): number {
  const total = getTotalByType(totals, 'TOTAL');
  return total?.amount ?? 0;
}
