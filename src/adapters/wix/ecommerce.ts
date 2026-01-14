/**
 * Wix eCommerce API Client
 * 
 * Client for Wix eCommerce APIs (Cart, Checkout, Orders).
 * Provides methods for cart management, checkout flow, and order operations.
 */

import { logger } from '../../lib/logger.js';
import { WixClient, WixClientError, createWixClient, isDemoMode } from './client.js';
import type {
  WixCheckout,
  WixLineItem,
  WixOrder,
  WixBillingAddress,
  WixPriceSummary,
  WixShippingInfo,
  WixFulfillment,
  WixPaging,
} from './types.js';

// ─────────────────────────────────────────────────────────────
// Request/Response Types
// ─────────────────────────────────────────────────────────────

/**
 * Create cart request
 */
export interface CreateCartRequest {
  lineItems: Array<{
    catalogReference: {
      catalogItemId: string;
      appId: string;
      options?: Record<string, unknown>;
    };
    quantity: number;
  }>;
  buyerInfo?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  couponCode?: string;
}

/**
 * Cart response
 */
export interface WixCart {
  id: string;
  lineItems: WixLineItem[];
  buyerInfo?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    memberId?: string;
  };
  currency: string;
  subtotal: WixPriceSummary;
  appliedCoupons?: Array<{
    code: string;
    name: string;
    discountValue: string;
  }>;
  createdDate: string;
  updatedDate: string;
}

/**
 * Add to cart request
 */
export interface AddToCartRequest {
  lineItems: Array<{
    catalogReference: {
      catalogItemId: string;
      appId: string;
      options?: Record<string, unknown>;
    };
    quantity: number;
  }>;
}

/**
 * Update cart item request
 */
export interface UpdateCartItemRequest {
  lineItemId: string;
  quantity?: number;
}

/**
 * Create checkout from cart request
 */
export interface CreateCheckoutFromCartRequest {
  cartId: string;
  channelType?: 'WEB' | 'POS' | 'EBAY' | 'AMAZON' | 'OTHER';
}

/**
 * Update checkout request
 */
export interface UpdateCheckoutRequest {
  buyerInfo?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  shippingInfo?: {
    shippingDestination?: {
      address: WixBillingAddress;
      contactDetails?: {
        firstName?: string;
        lastName?: string;
        phone?: string;
      };
    };
    selectedCarrierServiceOption?: {
      carrierId: string;
      code: string;
    };
  };
  billingInfo?: {
    address?: WixBillingAddress;
    contactDetails?: {
      firstName?: string;
      lastName?: string;
      phone?: string;
    };
  };
}

/**
 * Create order from checkout request
 */
export interface CreateOrderFromCheckoutRequest {
  checkoutId: string;
  paymentToken?: string;
}

/**
 * Shipping rates response
 */
export interface ShippingRatesResponse {
  shippingRates: Array<{
    carrierId: string;
    carrierName: string;
    code: string;
    title: string;
    logistics: {
      deliveryTime?: string;
      instructions?: string;
    };
    cost: {
      price: string;
      currency: string;
    };
  }>;
}

/**
 * List orders request
 */
export interface ListOrdersRequest {
  paging?: {
    limit?: number;
    offset?: number;
  };
  filter?: {
    status?: WixOrder['status'];
    paymentStatus?: WixOrder['paymentStatus'];
    fulfillmentStatus?: WixOrder['fulfillmentStatus'];
    createdDate?: {
      $gte?: string;
      $lte?: string;
    };
  };
  sort?: Array<{
    fieldName: string;
    order: 'ASC' | 'DESC';
  }>;
}

/**
 * List orders response
 */
export interface ListOrdersResponse {
  orders: WixOrder[];
  pagingMetadata?: WixPaging;
}

// ─────────────────────────────────────────────────────────────
// eCommerce Client
// ─────────────────────────────────────────────────────────────

/**
 * Wix eCommerce client options
 */
export interface WixEcommerceClientOptions {
  /** Use mock responses (for testing) */
  mockMode?: boolean;
}

/**
 * Wix eCommerce API client
 */
export class WixEcommerceClient {
  private client: WixClient | null;
  private mockMode: boolean;

  constructor(client?: WixClient | null, options: WixEcommerceClientOptions = {}) {
    // Use DEMO_MODE environment variable to control mock mode
    // Can be overridden by options.mockMode for testing
    this.mockMode = options.mockMode ?? isDemoMode();
    
    // Only create Wix client if not in mock mode
    if (this.mockMode) {
      this.client = null;
      logger.info('WixEcommerceClient initialized in DEMO mode (mock data)');
    } else {
      this.client = client ?? createWixClient();
      if (!this.client) {
        logger.warn('Wix credentials missing - falling back to DEMO mode');
        this.mockMode = true;
      } else {
        logger.info('WixEcommerceClient initialized in LIVE mode (real Wix APIs)');
      }
    }
  }

  /**
   * Check if running in mock mode
   */
  isInMockMode(): boolean {
    return this.mockMode;
  }

  // ─────────────────────────────────────────────────────────────
  // Cart API
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a new cart
   */
  async createCart(request: CreateCartRequest): Promise<WixCart> {
    if (this.mockMode) {
      return this.mockCreateCart(request);
    }

    return this.client!.post<{ cart: WixCart }>(
      '/ecom/v1/carts',
      request
    ).then((res) => res.cart);
  }

  /**
   * Get cart by ID
   */
  async getCart(cartId: string): Promise<WixCart> {
    if (this.mockMode) {
      return this.mockGetCart(cartId);
    }

    return this.client!.get<{ cart: WixCart }>(
      `/ecom/v1/carts/${cartId}`
    ).then((res) => res.cart);
  }

  /**
   * Add items to cart
   */
  async addToCart(cartId: string, request: AddToCartRequest): Promise<WixCart> {
    if (this.mockMode) {
      return this.mockGetCart(cartId);
    }

    return this.client!.post<{ cart: WixCart }>(
      `/ecom/v1/carts/${cartId}/add-to-cart`,
      request
    ).then((res) => res.cart);
  }

  /**
   * Update cart item quantity
   */
  async updateCartItem(cartId: string, request: UpdateCartItemRequest): Promise<WixCart> {
    if (this.mockMode) {
      return this.mockGetCart(cartId);
    }

    return this.client!.post<{ cart: WixCart }>(
      `/ecom/v1/carts/${cartId}/update-line-item-quantity`,
      request
    ).then((res) => res.cart);
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(cartId: string, lineItemId: string): Promise<WixCart> {
    if (this.mockMode) {
      return this.mockGetCart(cartId);
    }

    return this.client!.post<{ cart: WixCart }>(
      `/ecom/v1/carts/${cartId}/remove-line-items`,
      { lineItemIds: [lineItemId] }
    ).then((res) => res.cart);
  }

  /**
   * Delete cart
   */
  async deleteCart(cartId: string): Promise<void> {
    if (this.mockMode) {
      return;
    }

    await this.client!.delete(`/ecom/v1/carts/${cartId}`);
  }

  // ─────────────────────────────────────────────────────────────
  // Checkout API
  // ─────────────────────────────────────────────────────────────

  /**
   * Create checkout from cart
   */
  async createCheckoutFromCart(request: CreateCheckoutFromCartRequest): Promise<WixCheckout> {
    if (this.mockMode) {
      return this.mockCreateCheckout(request.cartId);
    }

    return this.client!.post<{ checkout: WixCheckout }>(
      '/ecom/v1/checkouts/create-checkout-from-cart',
      request
    ).then((res) => res.checkout);
  }

  /**
   * Get checkout by ID
   */
  async getCheckout(checkoutId: string): Promise<WixCheckout> {
    if (this.mockMode) {
      return this.mockGetCheckout(checkoutId);
    }

    return this.client!.get<{ checkout: WixCheckout }>(
      `/ecom/v1/checkouts/${checkoutId}`
    ).then((res) => res.checkout);
  }

  /**
   * Update checkout
   */
  async updateCheckout(checkoutId: string, request: UpdateCheckoutRequest): Promise<WixCheckout> {
    if (this.mockMode) {
      return this.mockGetCheckout(checkoutId);
    }

    return this.client!.post<{ checkout: WixCheckout }>(
      `/ecom/v1/checkouts/${checkoutId}/update`,
      request
    ).then((res) => res.checkout);
  }

  /**
   * Get available shipping rates for checkout
   */
  async getShippingRates(checkoutId: string): Promise<ShippingRatesResponse> {
    if (this.mockMode) {
      return this.mockGetShippingRates();
    }

    return this.client!.post<ShippingRatesResponse>(
      `/ecom/v1/checkouts/${checkoutId}/get-shipping-rates`,
      {}
    );
  }

  /**
   * Select shipping option for checkout
   */
  async selectShippingOption(
    checkoutId: string,
    carrierId: string,
    code: string
  ): Promise<WixCheckout> {
    if (this.mockMode) {
      return this.mockGetCheckout(checkoutId);
    }

    return this.client!.post<{ checkout: WixCheckout }>(
      `/ecom/v1/checkouts/${checkoutId}/select-shipping-option`,
      { selectedCarrierServiceOption: { carrierId, code } }
    ).then((res) => res.checkout);
  }

  /**
   * Apply coupon to checkout
   */
  async applyCoupon(checkoutId: string, couponCode: string): Promise<WixCheckout> {
    if (this.mockMode) {
      return this.mockGetCheckout(checkoutId);
    }

    return this.client!.post<{ checkout: WixCheckout }>(
      `/ecom/v1/checkouts/${checkoutId}/apply-coupon`,
      { couponCode }
    ).then((res) => res.checkout);
  }

  /**
   * Remove coupon from checkout
   */
  async removeCoupon(checkoutId: string): Promise<WixCheckout> {
    if (this.mockMode) {
      return this.mockGetCheckout(checkoutId);
    }

    return this.client!.post<{ checkout: WixCheckout }>(
      `/ecom/v1/checkouts/${checkoutId}/remove-coupon`,
      {}
    ).then((res) => res.checkout);
  }

  // ─────────────────────────────────────────────────────────────
  // Order API
  // ─────────────────────────────────────────────────────────────

  /**
   * Create order from checkout
   */
  async createOrderFromCheckout(request: CreateOrderFromCheckoutRequest): Promise<WixOrder> {
    if (this.mockMode) {
      return this.mockCreateOrder(request.checkoutId);
    }

    return this.client!.post<{ order: WixOrder }>(
      '/ecom/v1/orders/create-order-from-checkout',
      request
    ).then((res) => res.order);
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<WixOrder> {
    if (this.mockMode) {
      return this.mockGetOrder(orderId);
    }

    return this.client!.get<{ order: WixOrder }>(
      `/ecom/v1/orders/${orderId}`
    ).then((res) => res.order);
  }

  /**
   * List orders
   */
  async listOrders(request: ListOrdersRequest = {}): Promise<ListOrdersResponse> {
    if (this.mockMode) {
      return this.mockListOrders();
    }

    return this.client!.post<ListOrdersResponse>(
      '/ecom/v1/orders/query',
      {
        query: {
          paging: request.paging,
          filter: request.filter,
          sort: request.sort,
        },
      }
    );
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string): Promise<WixOrder> {
    if (this.mockMode) {
      const order = await this.mockGetOrder(orderId);
      return { ...order, status: 'CANCELED' };
    }

    return this.client!.post<{ order: WixOrder }>(
      `/ecom/v1/orders/${orderId}/cancel`,
      {}
    ).then((res) => res.order);
  }

  /**
   * Create fulfillment for order
   */
  async createFulfillment(
    orderId: string,
    lineItems: Array<{ lineItemId: string; quantity: number }>,
    trackingInfo?: { trackingNumber: string; shippingProvider: string; trackingLink?: string }
  ): Promise<WixFulfillment> {
    if (this.mockMode) {
      return this.mockCreateFulfillment(orderId, lineItems, trackingInfo);
    }

    return this.client!.post<{ fulfillment: WixFulfillment }>(
      `/ecom/v1/orders/${orderId}/fulfillments`,
      { lineItems, trackingInfo }
    ).then((res) => res.fulfillment);
  }

  // ─────────────────────────────────────────────────────────────
  // Mock Implementations
  // ─────────────────────────────────────────────────────────────

  private mockCreateCart(request: CreateCartRequest): WixCart {
    const now = new Date().toISOString();
    return {
      id: `cart_${Date.now()}`,
      lineItems: request.lineItems.map((item, index) => ({
        id: `li_${index}`,
        productName: `Product ${item.catalogReference.catalogItemId}`,
        quantity: item.quantity,
        price: '10.00',
        totalPrice: (10 * item.quantity).toFixed(2),
        catalogReference: item.catalogReference,
      })),
      buyerInfo: request.buyerInfo,
      currency: 'USD',
      subtotal: {
        subtotal: (request.lineItems.reduce((sum, item) => sum + item.quantity * 10, 0)).toFixed(2),
        total: (request.lineItems.reduce((sum, item) => sum + item.quantity * 10, 0)).toFixed(2),
      },
      createdDate: now,
      updatedDate: now,
    };
  }

  private mockGetCart(cartId: string): WixCart {
    const now = new Date().toISOString();
    return {
      id: cartId,
      lineItems: [
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
        },
      ],
      currency: 'USD',
      subtotal: {
        subtotal: '50.00',
        total: '50.00',
      },
      createdDate: now,
      updatedDate: now,
    };
  }

  private mockCreateCheckout(cartId: string): WixCheckout {
    const now = new Date().toISOString();
    return {
      id: `chkout_${Date.now()}`,
      cartId,
      lineItems: [
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
        },
      ],
      priceSummary: {
        subtotal: '50.00',
        shipping: '5.99',
        tax: '4.48',
        total: '60.47',
      },
      currency: 'USD',
      createdDate: now,
      updatedDate: now,
    };
  }

  private mockGetCheckout(checkoutId: string): WixCheckout {
    const now = new Date().toISOString();
    return {
      id: checkoutId,
      cartId: `cart_${Date.now()}`,
      buyerInfo: {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      },
      lineItems: [
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
        },
      ],
      shippingInfo: {
        carrierServiceOption: {
          carrierId: 'usps',
          serviceName: 'Standard Shipping',
          cost: '5.99',
        },
        shippingDestination: {
          address: {
            addressLine1: '123 Main St',
            city: 'New York',
            subdivision: 'NY',
            country: 'US',
            postalCode: '10001',
          },
        },
      },
      priceSummary: {
        subtotal: '50.00',
        shipping: '5.99',
        tax: '4.48',
        total: '60.47',
      },
      currency: 'USD',
      createdDate: now,
      updatedDate: now,
    };
  }

  private mockGetShippingRates(): ShippingRatesResponse {
    return {
      shippingRates: [
        {
          carrierId: 'usps',
          carrierName: 'USPS',
          code: 'standard',
          title: 'Standard Shipping',
          logistics: {
            deliveryTime: '5-7 business days',
          },
          cost: {
            price: '5.99',
            currency: 'USD',
          },
        },
        {
          carrierId: 'fedex',
          carrierName: 'FedEx',
          code: 'express',
          title: 'Express Shipping',
          logistics: {
            deliveryTime: '2-3 business days',
          },
          cost: {
            price: '12.99',
            currency: 'USD',
          },
        },
        {
          carrierId: 'fedex',
          carrierName: 'FedEx',
          code: 'overnight',
          title: 'Overnight Shipping',
          logistics: {
            deliveryTime: 'Next business day',
          },
          cost: {
            price: '24.99',
            currency: 'USD',
          },
        },
      ],
    };
  }

  private mockCreateOrder(checkoutId: string): WixOrder {
    const now = new Date().toISOString();
    return {
      id: `order_${Date.now()}`,
      number: `ORD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      status: 'APPROVED',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'NOT_FULFILLED',
      buyerInfo: {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      },
      lineItems: [
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
        },
      ],
      totals: {
        subtotal: '50.00',
        shipping: '5.99',
        tax: '4.48',
        total: '60.47',
      },
      currency: 'USD',
      createdDate: now,
      updatedDate: now,
    };
  }

  private mockGetOrder(orderId: string): WixOrder {
    const now = new Date().toISOString();
    return {
      id: orderId,
      number: `ORD-${orderId.slice(-6).toUpperCase()}`,
      status: 'APPROVED',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'NOT_FULFILLED',
      buyerInfo: {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      },
      lineItems: [
        {
          id: 'li_1',
          productName: 'Test Product',
          quantity: 2,
          price: '25.00',
          totalPrice: '50.00',
        },
      ],
      totals: {
        subtotal: '50.00',
        shipping: '5.99',
        tax: '4.48',
        total: '60.47',
      },
      currency: 'USD',
      createdDate: now,
      updatedDate: now,
    };
  }

  private mockListOrders(): ListOrdersResponse {
    return {
      orders: [this.mockGetOrder(`order_${Date.now()}`)],
      pagingMetadata: {
        limit: 50,
        offset: 0,
        total: 1,
      },
    };
  }

  private mockCreateFulfillment(
    orderId: string,
    lineItems: Array<{ lineItemId: string; quantity: number }>,
    trackingInfo?: { trackingNumber: string; shippingProvider: string; trackingLink?: string }
  ): WixFulfillment {
    return {
      id: `ff_${Date.now()}`,
      lineItems,
      trackingInfo,
      createdDate: new Date().toISOString(),
    };
  }
}

/**
 * Create eCommerce client from environment
 */
export function createWixEcommerceClient(
  options?: WixEcommerceClientOptions
): WixEcommerceClient {
  return new WixEcommerceClient(undefined, options);
}

/**
 * Default client instance
 */
let defaultClient: WixEcommerceClient | null = null;

/**
 * Get default eCommerce client
 */
export function getWixEcommerceClient(): WixEcommerceClient {
  if (!defaultClient) {
    defaultClient = createWixEcommerceClient();
  }
  return defaultClient;
}
