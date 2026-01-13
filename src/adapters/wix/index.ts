/**
 * Wix API Adapters
 * 
 * Client adapters for Wix Platform APIs.
 * Provides typed interfaces for Wix services.
 */

// Types
export * from './types.js';

// Base client
export { WixClient, WixClientError, createWixClient, type WixClientConfig } from './client.js';

// Payments client
export {
  WixPaymentsClient,
  createWixPaymentsClient,
  createMockWixPaymentsClient,
} from './payments.js';

// eCommerce client
export {
  WixEcommerceClient,
  createWixEcommerceClient,
  getWixEcommerceClient,
  type WixEcommerceClientOptions,
  type CreateCartRequest,
  type WixCart,
  type AddToCartRequest,
  type UpdateCartItemRequest,
  type CreateCheckoutFromCartRequest,
  type UpdateCheckoutRequest,
  type CreateOrderFromCheckoutRequest,
  type ShippingRatesResponse,
  type ListOrdersRequest,
  type ListOrdersResponse,
} from './ecommerce.js';

// Members client will be added later
// export * from './members.js';
