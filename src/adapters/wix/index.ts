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

// eCommerce client will be added later
// export * from './ecommerce.js';

// Members client will be added later
// export * from './members.js';
