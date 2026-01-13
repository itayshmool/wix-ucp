/**
 * Order Mappers
 * 
 * Maps Wix Order data to UCP format.
 * See: .cursor/rules/modules/orders.mdc
 */

import { UCP_PROTOCOL } from '../../core/constants.js';
import { env } from '../../config/env.js';

const UCP_BASE_URL = env.UCP_BASE_URL ?? 'http://localhost:3000';
import type { Total, Money } from '../../core/types/ucp-common.js';
import type {
  OrderResponse,
  OrderSummary,
  OrderLineItem,
  OrderPayment,
  OrderFulfillment,
  OrderLink,
  Shipment,
  TrackingEvent,
  ShipmentStatus,
} from './types.js';
import {
  mapWixOrderStatus,
  mapWixPaymentStatus,
} from './state-machine.js';

// ─────────────────────────────────────────────────────────────
// Wix Order Types (simplified)
// ─────────────────────────────────────────────────────────────

export interface WixOrder {
  id: string;
  number: string | number;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  buyerInfo?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  lineItems: WixOrderLineItem[];
  totals?: {
    subtotal?: string;
    shipping?: string;
    tax?: string;
    discount?: string;
    total?: string;
  };
  priceSummary?: {
    subtotal?: string;
    shipping?: string;
    tax?: string;
    discount?: string;
    total?: string;
  };
  currency: string;
  shippingInfo?: {
    shipmentDetails?: {
      address?: {
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        subdivision?: string;
        country?: string;
        postalCode?: string;
      };
    };
    logistics?: {
      shippingDestination?: {
        address?: {
          addressLine1?: string;
          city?: string;
          country?: string;
          postalCode?: string;
          subdivision?: string;
        };
      };
    };
  };
  fulfillments?: WixFulfillment[];
  createdDate?: string;
  updatedDate?: string;
  dateCreated?: string;
  dateUpdated?: string;
  checkoutId?: string;
}

interface WixOrderLineItem {
  id?: string;
  _id?: string;
  productName?: {
    original?: string;
  };
  name?: string;
  catalogReference?: {
    catalogItemId?: string;
  };
  quantity?: number;
  price?: string;
  priceData?: {
    price?: string;
    totalPrice?: string;
  };
  totalPrice?: string;
  image?: {
    url?: string;
  };
  mediaItem?: {
    url?: string;
  };
  sku?: string;
  fulfillmentStatus?: string;
}

interface WixFulfillment {
  id: string;
  lineItems?: Array<{ id: string; quantity: number }>;
  trackingInfo?: {
    shippingProvider?: string;
    trackingNumber?: string;
    trackingLink?: string;
  };
  createdDate?: string;
}

// ─────────────────────────────────────────────────────────────
// Order Mapping
// ─────────────────────────────────────────────────────────────

/**
 * Map Wix order to UCP OrderResponse
 */
export function mapWixOrderToUCP(wixOrder: WixOrder): OrderResponse {
  const status = mapWixOrderStatus(
    wixOrder.status,
    wixOrder.paymentStatus,
    wixOrder.fulfillmentStatus
  );

  return {
    ucp: { version: UCP_PROTOCOL.version },
    id: wixOrder.id,
    checkoutId: wixOrder.checkoutId,
    confirmationNumber: String(wixOrder.number),
    status,
    buyer: {
      email: wixOrder.buyerInfo?.email ?? '',
      firstName: wixOrder.buyerInfo?.firstName,
      lastName: wixOrder.buyerInfo?.lastName,
      phone: wixOrder.buyerInfo?.phone,
    },
    lineItems: mapWixLineItems(wixOrder.lineItems),
    totals: mapWixOrderTotals(wixOrder.totals ?? wixOrder.priceSummary, wixOrder.currency),
    payment: mapWixPayment(wixOrder),
    fulfillment: mapWixFulfillment(wixOrder),
    currency: wixOrder.currency,
    createdAt: wixOrder.createdDate ?? wixOrder.dateCreated ?? new Date().toISOString(),
    updatedAt: wixOrder.updatedDate ?? wixOrder.dateUpdated ?? new Date().toISOString(),
    links: generateOrderLinks(wixOrder.id),
  };
}

/**
 * Map Wix order to OrderSummary
 */
export function mapWixOrderToSummary(wixOrder: WixOrder): OrderSummary {
  const status = mapWixOrderStatus(
    wixOrder.status,
    wixOrder.paymentStatus,
    wixOrder.fulfillmentStatus
  );

  const totals = wixOrder.totals ?? wixOrder.priceSummary;
  const totalAmount = parseFloat(totals?.total ?? '0') * 100; // Convert to minor units

  return {
    id: wixOrder.id,
    confirmationNumber: String(wixOrder.number),
    status,
    itemCount: wixOrder.lineItems.reduce((sum, item) => sum + (item.quantity ?? 1), 0),
    total: {
      amount: Math.round(totalAmount),
      currency: wixOrder.currency,
    },
    createdAt: wixOrder.createdDate ?? wixOrder.dateCreated ?? new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// Line Item Mapping
// ─────────────────────────────────────────────────────────────

/**
 * Map Wix line items to UCP format
 */
function mapWixLineItems(wixLineItems: WixOrderLineItem[]): OrderLineItem[] {
  return wixLineItems.map((item) => {
    const unitPriceStr = item.price ?? item.priceData?.price ?? '0';
    const totalPriceStr = item.totalPrice ?? item.priceData?.totalPrice ?? unitPriceStr;
    const currency = 'USD'; // Default, should come from order

    return {
      id: item.id ?? item._id ?? '',
      productId: item.catalogReference?.catalogItemId ?? item.id ?? item._id ?? '',
      name: item.productName?.original ?? item.name ?? 'Unknown Product',
      sku: item.sku,
      quantity: item.quantity ?? 1,
      unitPrice: {
        amount: Math.round(parseFloat(unitPriceStr) * 100),
        currency,
      },
      totalPrice: {
        amount: Math.round(parseFloat(totalPriceStr) * 100),
        currency,
      },
      imageUrl: item.image?.url ?? item.mediaItem?.url,
      fulfillmentStatus: mapLineItemFulfillmentStatus(item.fulfillmentStatus),
    };
  });
}

function mapLineItemFulfillmentStatus(
  status?: string
): 'unfulfilled' | 'fulfilled' | 'partially_fulfilled' | undefined {
  if (!status) return undefined;

  const statusMap: Record<string, 'unfulfilled' | 'fulfilled' | 'partially_fulfilled'> = {
    'NOT_FULFILLED': 'unfulfilled',
    'FULFILLED': 'fulfilled',
    'PARTIALLY_FULFILLED': 'partially_fulfilled',
  };

  return statusMap[status];
}

// ─────────────────────────────────────────────────────────────
// Totals Mapping
// ─────────────────────────────────────────────────────────────

/**
 * Map Wix order totals to UCP format
 */
function mapWixOrderTotals(
  totals: WixOrder['totals'],
  _currency?: string
): Total[] {
  if (!totals) {
    return [];
  }

  const result: Total[] = [];

  if (totals.subtotal) {
    result.push({
      type: 'SUBTOTAL',
      amount: Math.round(parseFloat(totals.subtotal) * 100),
      label: 'Subtotal',
    });
  }

  if (totals.shipping) {
    result.push({
      type: 'SHIPPING',
      amount: Math.round(parseFloat(totals.shipping) * 100),
      label: 'Shipping',
    });
  }

  if (totals.tax) {
    result.push({
      type: 'TAX',
      amount: Math.round(parseFloat(totals.tax) * 100),
      label: 'Tax',
    });
  }

  if (totals.discount) {
    result.push({
      type: 'DISCOUNT',
      amount: -Math.round(parseFloat(totals.discount) * 100),
      label: 'Discount',
    });
  }

  if (totals.total) {
    result.push({
      type: 'TOTAL',
      amount: Math.round(parseFloat(totals.total) * 100),
      label: 'Total',
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Payment Mapping
// ─────────────────────────────────────────────────────────────

/**
 * Map Wix payment info to UCP format
 */
function mapWixPayment(wixOrder: WixOrder): OrderPayment {
  return {
    status: mapWixPaymentStatus(wixOrder.paymentStatus),
    method: 'credit_card', // Default, would come from actual payment data
    transactionId: undefined, // Would come from transactions array
  };
}

// ─────────────────────────────────────────────────────────────
// Fulfillment Mapping
// ─────────────────────────────────────────────────────────────

/**
 * Map Wix fulfillment info to UCP format
 */
function mapWixFulfillment(wixOrder: WixOrder): OrderFulfillment {
  const statusMap: Record<string, OrderFulfillment['status']> = {
    'NOT_FULFILLED': 'unfulfilled',
    'FULFILLED': 'fulfilled',
    'PARTIALLY_FULFILLED': 'partially_fulfilled',
  };

  const shippingAddress = wixOrder.shippingInfo?.shipmentDetails?.address ??
    wixOrder.shippingInfo?.logistics?.shippingDestination?.address;

  return {
    status: statusMap[wixOrder.fulfillmentStatus] ?? 'unfulfilled',
    shippingAddress: shippingAddress ? {
      line1: shippingAddress.addressLine1 ?? '',
      city: shippingAddress.city ?? '',
      state: shippingAddress.subdivision,
      postalCode: shippingAddress.postalCode ?? '',
      country: shippingAddress.country ?? '',
    } : undefined,
  };
}

/**
 * Map Wix fulfillments to shipments
 */
export function mapWixFulfillmentsToShipments(
  fulfillments: WixFulfillment[] | undefined
): Shipment[] {
  if (!fulfillments || fulfillments.length === 0) {
    return [];
  }

  return fulfillments.map((fulfillment) => ({
    id: fulfillment.id,
    carrier: fulfillment.trackingInfo?.shippingProvider ?? 'Unknown',
    trackingNumber: fulfillment.trackingInfo?.trackingNumber ?? '',
    trackingUrl: fulfillment.trackingInfo?.trackingLink,
    status: 'in_transit' as ShipmentStatus,
    events: [],
    items: fulfillment.lineItems?.map((li) => li.id) ?? [],
  }));
}

// ─────────────────────────────────────────────────────────────
// HATEOAS Links
// ─────────────────────────────────────────────────────────────

/**
 * Generate HATEOAS links for an order
 */
export function generateOrderLinks(orderId: string, baseUrl?: string): OrderLink[] {
  const base = baseUrl ?? UCP_BASE_URL;

  return [
    {
      rel: 'self',
      href: `${base}/ucp/v1/orders/${orderId}`,
      method: 'GET',
    },
    {
      rel: 'tracking',
      href: `${base}/ucp/v1/orders/${orderId}/tracking`,
      method: 'GET',
    },
    {
      rel: 'return',
      href: `${base}/ucp/v1/orders/${orderId}/return`,
      method: 'POST',
    },
  ];
}
