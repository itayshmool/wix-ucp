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
  WixProduct,
  WixProductsQueryResponse,
  WixMember,
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
  // Catalog/Products API (Wix Stores)
  // ─────────────────────────────────────────────────────────────

  /**
   * Search products
   */
  async searchProducts(query: string = '', options: {
    limit?: number;
    offset?: number;
    collectionId?: string;
  } = {}): Promise<WixProductsQueryResponse> {
    if (this.mockMode) {
      return this.mockSearchProducts(query, options);
    }

    const { limit = 50, offset = 0, collectionId } = options;

    // Build filter
    const filter: Record<string, unknown> = {};
    if (query) {
      filter.name = { $contains: query };
    }
    if (collectionId) {
      filter['collections.id'] = collectionId;
    }

    return this.client!.post<WixProductsQueryResponse>(
      '/stores/v1/products/query',
      {
        query: {
          filter,
          paging: { limit, offset },
          sort: [{ fieldName: 'name', order: 'ASC' }],
        },
      }
    );
  }

  /**
   * Get product by ID
   */
  async getProduct(productId: string): Promise<WixProduct> {
    if (this.mockMode) {
      return this.mockGetProduct(productId);
    }

    return this.client!.get<{ product: WixProduct }>(
      `/stores/v1/products/${productId}`
    ).then((res) => res.product);
  }

  /**
   * Get product by slug
   */
  async getProductBySlug(slug: string): Promise<WixProduct | null> {
    if (this.mockMode) {
      return this.mockGetProductBySlug(slug);
    }

    const response = await this.client!.post<WixProductsQueryResponse>(
      '/stores/v1/products/query',
      {
        query: {
          filter: { slug },
          paging: { limit: 1 },
        },
      }
    );

    return response.products[0] || null;
  }

  // ─────────────────────────────────────────────────────────────
  // Members API
  // ─────────────────────────────────────────────────────────────

  /**
   * Get member by ID
   */
  async getMember(memberId: string): Promise<WixMember> {
    if (this.mockMode) {
      return this.mockGetMember(memberId);
    }

    return this.client!.get<{ member: WixMember }>(
      `/members/v1/members/${memberId}`
    ).then((res) => res.member);
  }

  /**
   * Get current member (from auth context)
   */
  async getCurrentMember(): Promise<WixMember | null> {
    if (this.mockMode) {
      return this.mockGetMember('member_current');
    }

    try {
      return await this.client!.get<{ member: WixMember }>(
        '/members/v1/members/current'
      ).then((res) => res.member);
    } catch (error) {
      // No logged-in member
      if (error instanceof WixClientError && error.code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
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

  // ─────────────────────────────────────────────────────────────
  // Mock Products/Catalog
  // ─────────────────────────────────────────────────────────────

  private mockSearchProducts(
    query: string,
    options: { limit?: number; offset?: number } = {}
  ): WixProductsQueryResponse {
    const { limit = 50, offset = 0 } = options;
    const now = new Date().toISOString();
    
    const allProducts: WixProduct[] = [
      {
        id: 'prod_demo_001',
        name: 'Premium Wireless Headphones',
        slug: 'premium-wireless-headphones',
        visible: true,
        productType: 'physical',
        description: 'High-quality wireless headphones with noise cancellation',
        sku: 'WH-001',
        weight: 0.5,
        stock: { inStock: true, quantity: 100, trackInventory: true },
        priceData: {
          currency: 'USD',
          price: 149.99,
          discountedPrice: 129.99,
          formatted: { price: '$149.99', discountedPrice: '$129.99' },
        },
        media: {
          mainMedia: {
            id: 'img_1',
            url: 'https://static.wixstatic.com/media/demo_headphones.jpg',
            mediaType: 'IMAGE',
          },
          items: [],
        },
        productOptions: [
          {
            name: 'Color',
            optionType: 'DROP_DOWN',
            choices: [
              { value: 'Black', inStock: true, visible: true },
              { value: 'White', inStock: true, visible: true },
              { value: 'Silver', inStock: false, visible: true },
            ],
          },
        ],
        variants: [],
        brand: 'TechAudio',
        createdDate: now,
        lastUpdated: now,
      },
      {
        id: 'prod_demo_002',
        name: 'Organic Cotton T-Shirt',
        slug: 'organic-cotton-tshirt',
        visible: true,
        productType: 'physical',
        description: 'Comfortable 100% organic cotton t-shirt',
        sku: 'TS-002',
        weight: 0.2,
        stock: { inStock: true, quantity: 250, trackInventory: true },
        priceData: {
          currency: 'USD',
          price: 29.99,
          formatted: { price: '$29.99' },
        },
        media: {
          mainMedia: {
            id: 'img_2',
            url: 'https://static.wixstatic.com/media/demo_tshirt.jpg',
            mediaType: 'IMAGE',
          },
          items: [],
        },
        productOptions: [
          {
            name: 'Size',
            optionType: 'DROP_DOWN',
            choices: [
              { value: 'S', inStock: true, visible: true },
              { value: 'M', inStock: true, visible: true },
              { value: 'L', inStock: true, visible: true },
              { value: 'XL', inStock: false, visible: true },
            ],
          },
          {
            name: 'Color',
            optionType: 'DROP_DOWN',
            choices: [
              { value: 'Navy', inStock: true, visible: true },
              { value: 'White', inStock: true, visible: true },
              { value: 'Grey', inStock: true, visible: true },
            ],
          },
        ],
        variants: [],
        brand: 'EcoWear',
        createdDate: now,
        lastUpdated: now,
      },
      {
        id: 'prod_demo_003',
        name: 'Digital Photography Course',
        slug: 'digital-photography-course',
        visible: true,
        productType: 'digital',
        description: 'Complete online course for photography beginners',
        sku: 'DPC-003',
        stock: { inStock: true, trackInventory: false },
        priceData: {
          currency: 'USD',
          price: 79.99,
          discountedPrice: 49.99,
          formatted: { price: '$79.99', discountedPrice: '$49.99' },
        },
        media: {
          mainMedia: {
            id: 'img_3',
            url: 'https://static.wixstatic.com/media/demo_course.jpg',
            mediaType: 'IMAGE',
          },
          items: [],
        },
        productOptions: [],
        variants: [],
        createdDate: now,
        lastUpdated: now,
      },
      {
        id: 'prod_demo_004',
        name: 'Stainless Steel Water Bottle',
        slug: 'stainless-steel-water-bottle',
        visible: true,
        productType: 'physical',
        description: 'Insulated water bottle keeps drinks cold for 24 hours',
        sku: 'WB-004',
        weight: 0.3,
        stock: { inStock: true, quantity: 500, trackInventory: true },
        priceData: {
          currency: 'USD',
          price: 24.99,
          formatted: { price: '$24.99' },
        },
        media: {
          mainMedia: {
            id: 'img_4',
            url: 'https://static.wixstatic.com/media/demo_bottle.jpg',
            mediaType: 'IMAGE',
          },
          items: [],
        },
        productOptions: [
          {
            name: 'Size',
            optionType: 'DROP_DOWN',
            choices: [
              { value: '500ml', inStock: true, visible: true },
              { value: '750ml', inStock: true, visible: true },
              { value: '1L', inStock: true, visible: true },
            ],
          },
        ],
        variants: [],
        brand: 'HydroLife',
        createdDate: now,
        lastUpdated: now,
      },
    ];

    // Filter by query if provided
    let filtered = allProducts;
    if (query) {
      const q = query.toLowerCase();
      filtered = allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q)
      );
    }

    // Apply pagination
    const paginated = filtered.slice(offset, offset + limit);

    return {
      products: paginated,
      metadata: {
        count: paginated.length,
        offset,
        total: filtered.length,
      },
    };
  }

  private mockGetProduct(productId: string): WixProduct {
    const result = this.mockSearchProducts('');
    const product = result.products.find((p) => p.id === productId);
    if (!product) {
      throw new WixClientError('Product not found', 404, 'NOT_FOUND');
    }
    return product;
  }

  private mockGetProductBySlug(slug: string): WixProduct | null {
    const result = this.mockSearchProducts('');
    return result.products.find((p) => p.slug === slug) || null;
  }

  // ─────────────────────────────────────────────────────────────
  // Mock Members
  // ─────────────────────────────────────────────────────────────

  private mockGetMember(memberId: string): WixMember {
    const now = new Date().toISOString();
    return {
      id: memberId,
      loginEmail: 'demo@example.com',
      status: 'APPROVED',
      contact: {
        firstName: 'Demo',
        lastName: 'User',
        phones: ['+1-555-123-4567'],
        emails: ['demo@example.com'],
        addresses: [
          {
            id: 'addr_1',
            addressLine1: '123 Demo Street',
            city: 'San Francisco',
            subdivision: 'CA',
            country: 'US',
            postalCode: '94102',
          },
        ],
      },
      profile: {
        nickname: 'DemoUser',
        slug: 'demo-user',
      },
      privacyStatus: 'PUBLIC',
      activityStatus: 'ACTIVE',
      createdDate: now,
      updatedDate: now,
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
