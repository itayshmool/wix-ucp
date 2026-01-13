/**
 * Cart Mapper
 * 
 * Maps Wix eCommerce data structures to UCP format.
 * See: .cursor/rules/modules/checkout.mdc
 */

import type { LineItem, Buyer, Address, Total, ItemType } from '../../core/types/ucp-common.js';
import type { CheckoutMessage, CheckoutLink, CheckoutStatus } from '../../core/types/checkout.js';
import type { WixCheckout, WixLineItem, WixPriceSummary } from '../../adapters/wix/types.js';
import { UCP_PROTOCOL } from '../../core/constants.js';

// Base URL for checkout links (from env or default)
const UCP_BASE_URL = process.env.UCP_BASE_URL ?? 'http://localhost:3000';
import { MESSAGE_CODES, CHECKOUT_CAPABILITY } from './types.js';

/**
 * Map Wix line items to UCP line items
 */
export function mapWixLineItemsToUCP(wixLineItems: WixLineItem[]): LineItem[] {
  return wixLineItems.map((item) => ({
    id: item.id,
    item: {
      id: item.catalogReference?.catalogItemId ?? item.id,
      title: item.productName,
      description: item.descriptionLines?.join(' '),
      price: parsePrice(item.price),
      imageUrl: item.image?.url,
      productUrl: undefined, // Would need full URL construction
      type: determineItemType(item),
    },
    quantity: item.quantity,
    totalPrice: parsePrice(item.totalPrice),
  }));
}

/**
 * Determine item type from Wix line item
 */
function determineItemType(item: WixLineItem): ItemType {
  // Digital products typically have specific catalog app IDs or product types
  // For now, default to physical
  return 'physical';
}

/**
 * Parse price string to number (minor units)
 */
function parsePrice(price: string | number): number {
  if (typeof price === 'number') {
    return Math.round(price * 100); // Convert to minor units
  }
  const parsed = parseFloat(price);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100);
}

/**
 * Map Wix buyer info to UCP Buyer
 */
export function mapWixBuyerToUCP(buyerInfo?: WixCheckout['buyerInfo']): Buyer | undefined {
  if (!buyerInfo?.email) {
    return undefined;
  }

  return {
    email: buyerInfo.email,
    firstName: buyerInfo.firstName,
    lastName: buyerInfo.lastName,
    phone: buyerInfo.phone,
  };
}

/**
 * Map Wix price summary to UCP totals
 */
export function mapWixTotalsToUCP(
  priceSummary: WixPriceSummary,
  currency: string
): Total[] {
  const totals: Total[] = [];

  // Subtotal
  const subtotal = parsePrice(priceSummary.subtotal);
  if (subtotal > 0) {
    totals.push({
      type: 'SUBTOTAL',
      label: 'Subtotal',
      amount: subtotal,
    });
  }

  // Shipping
  if (priceSummary.shipping) {
    const shipping = parsePrice(priceSummary.shipping);
    totals.push({
      type: 'SHIPPING',
      label: 'Shipping',
      amount: shipping,
    });
  }

  // Tax
  if (priceSummary.tax) {
    const tax = parsePrice(priceSummary.tax);
    totals.push({
      type: 'TAX',
      label: 'Tax',
      amount: tax,
    });
  }

  // Discount
  if (priceSummary.discount) {
    const discount = parsePrice(priceSummary.discount);
    if (discount > 0) {
      totals.push({
        type: 'DISCOUNT',
        label: 'Discount',
        amount: -discount, // Negative for discount
      });
    }
  }

  // Total
  totals.push({
    type: 'TOTAL',
    label: 'Total',
    amount: parsePrice(priceSummary.total),
  });

  return totals;
}

/**
 * Map Wix checkout status to UCP status
 */
export function mapWixStatusToUCP(wixCheckout: WixCheckout): CheckoutStatus {
  // Wix doesn't have explicit status field, determine from data
  const hasBuyer = !!wixCheckout.buyerInfo?.email;
  const hasShipping = !!wixCheckout.shippingInfo?.shippingDestination;
  
  if (!hasBuyer || !hasShipping) {
    return 'incomplete';
  }

  return 'ready_for_payment';
}

/**
 * Generate checkout messages based on session state
 */
export function generateMessages(
  buyer?: Buyer,
  hasPhysicalItems = true,
  selectedFulfillmentId?: string,
  shippingAddress?: Address,
  discountApplied = false
): CheckoutMessage[] {
  const messages: CheckoutMessage[] = [];

  // Missing email
  if (!buyer?.email) {
    messages.push({
      type: 'warning',
      code: MESSAGE_CODES.MISSING_EMAIL,
      message: 'Email address is required to complete checkout',
      field: 'buyer.email',
    });
  }

  // Missing shipping for physical items
  if (hasPhysicalItems && !selectedFulfillmentId) {
    messages.push({
      type: 'warning',
      code: MESSAGE_CODES.MISSING_SHIPPING,
      message: 'Please select a shipping method',
      field: 'fulfillment.selectedId',
    });
  }

  // Missing shipping address
  if (hasPhysicalItems && selectedFulfillmentId && !shippingAddress) {
    messages.push({
      type: 'warning',
      code: MESSAGE_CODES.MISSING_SHIPPING,
      message: 'Shipping address is required',
      field: 'shippingAddress',
    });
  }

  // Discount applied (info)
  if (discountApplied) {
    messages.push({
      type: 'info',
      code: MESSAGE_CODES.DISCOUNT_APPLIED,
      message: 'Discount code applied successfully',
    });
  }

  return messages;
}

/**
 * Generate HATEOAS links for checkout session
 */
export function generateLinks(checkoutId: string, baseUrl?: string): CheckoutLink[] {
  const base = baseUrl ?? UCP_BASE_URL;

  return [
    {
      rel: 'self',
      href: `${base}/checkout-sessions/${checkoutId}`,
      method: 'GET',
    },
    {
      rel: 'update',
      href: `${base}/checkout-sessions/${checkoutId}`,
      method: 'PATCH',
    },
    {
      rel: 'complete',
      href: `${base}/checkout-sessions/${checkoutId}/complete`,
      method: 'POST',
    },
    {
      rel: 'cancel',
      href: `${base}/checkout-sessions/${checkoutId}`,
      method: 'DELETE',
    },
  ];
}

/**
 * Build UCP version header for checkout response
 */
export function buildUCPHeader() {
  return {
    version: UCP_PROTOCOL.version,
    services: {
      'dev.ucp.shopping': {
        version: CHECKOUT_CAPABILITY.version,
        spec: CHECKOUT_CAPABILITY.spec,
      },
    },
  };
}

/**
 * Check if checkout has physical items requiring shipping
 */
export function hasPhysicalItems(lineItems: LineItem[]): boolean {
  return lineItems.some(
    (item) => !item.item.type || item.item.type === 'physical'
  );
}

/**
 * Calculate checkout expiration time
 * 
 * @param ttlSeconds - Time to live in seconds (default: 1 hour)
 */
export function calculateExpiry(ttlSeconds = 3600): string {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}
