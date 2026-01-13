/**
 * Test Data Factories
 * 
 * Use these to create consistent test data.
 * Following practices/testing.mdc guidelines.
 */

import { nanoid } from 'nanoid';

// ─────────────────────────────────────────────────────────────
// UCP Types Factories
// ─────────────────────────────────────────────────────────────

/**
 * Create a mock buyer
 */
export function createMockBuyer(overrides = {}) {
  return {
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    phone: '+1-555-0100',
    ...overrides,
  };
}

/**
 * Create a mock address
 */
export function createMockAddress(overrides = {}) {
  return {
    line1: '123 Test Street',
    line2: 'Apt 4B',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'US',
    ...overrides,
  };
}

/**
 * Create a mock line item
 */
export function createMockLineItem(overrides = {}) {
  return {
    id: `item-${nanoid(8)}`,
    item: {
      id: `prod-${nanoid(8)}`,
      title: 'Test Product',
      description: 'A test product description',
      price: 2999, // $29.99 in cents
      imageUrl: 'https://example.com/image.jpg',
      productUrl: 'https://example.com/product',
    },
    quantity: 1,
    totalPrice: 2999,
    ...overrides,
  };
}

/**
 * Create a mock checkout session
 */
export function createMockCheckoutSession(overrides = {}) {
  const checkoutId = `checkout-${nanoid(12)}`;
  
  return {
    id: checkoutId,
    status: 'incomplete' as const,
    currency: 'USD',
    buyer: createMockBuyer(),
    lineItems: [createMockLineItem()],
    totals: [
      { type: 'SUBTOTAL', label: 'Subtotal', amount: 2999 },
      { type: 'TAX', label: 'Tax', amount: 300 },
      { type: 'TOTAL', label: 'Total', amount: 3299 },
    ],
    payment: {
      handlers: [],
    },
    messages: [],
    links: [],
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Payment Factories
// ─────────────────────────────────────────────────────────────

/**
 * Create a mock payment token
 */
export function createMockPaymentToken(overrides = {}) {
  const tokenId = `token-${nanoid(12)}`;
  const checkoutId = `checkout-${nanoid(12)}`;
  
  return {
    id: tokenId,
    wixCardToken: `wix-card-${nanoid(16)}`,
    binding: {
      checkoutId,
      businessId: `biz-${nanoid(8)}`,
    },
    instrument: {
      type: 'card',
      brand: 'VISA',
      lastDigits: '4242',
      expiryMonth: '12',
      expiryYear: '2028',
    },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
    used: false,
    ...overrides,
  };
}

/**
 * Create a mock payment handler
 */
export function createMockPaymentHandler(overrides = {}) {
  return {
    id: `handler-${nanoid(8)}`,
    name: 'com.wix.payments',
    version: '2026-01-11',
    spec: 'https://dev.wix.com/ucp/payments/spec',
    config: {
      merchantId: `merchant-${nanoid(8)}`,
      environment: 'sandbox',
      supportedCardNetworks: ['VISA', 'MASTERCARD', 'AMEX'],
      supportedPaymentMethods: ['creditCard', 'googlePay'],
      supportedCurrencies: ['USD', 'EUR'],
      threeDSEnabled: true,
      tokenizationType: 'PAYMENT_GATEWAY',
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Wix API Response Factories
// ─────────────────────────────────────────────────────────────

/**
 * Create a mock Wix checkout response
 */
export function createMockWixCheckout(overrides = {}) {
  return {
    id: `wix-checkout-${nanoid(12)}`,
    currency: 'USD',
    buyerInfo: {
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    },
    lineItems: [
      {
        id: `item-${nanoid(8)}`,
        productName: { original: 'Test Product' },
        price: { amount: 2999 },
        quantity: 1,
        image: { url: 'https://example.com/image.jpg' },
      },
    ],
    priceSummary: {
      subtotal: { amount: 2999 },
      tax: { amount: 300 },
      total: { amount: 3299 },
    },
    createdDate: new Date().toISOString(),
    updatedDate: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock Wix order response
 */
export function createMockWixOrder(overrides = {}) {
  return {
    id: `wix-order-${nanoid(12)}`,
    number: 1001,
    checkoutId: `wix-checkout-${nanoid(12)}`,
    buyerInfo: {
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    },
    status: 'NOT_FULFILLED',
    paymentStatus: 'PAID',
    lineItems: [],
    priceSummary: {
      subtotal: { amount: 2999 },
      total: { amount: 3299 },
    },
    dateCreated: new Date().toISOString(),
    dateUpdated: new Date().toISOString(),
    ...overrides,
  };
}
