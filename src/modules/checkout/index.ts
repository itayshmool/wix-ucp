/**
 * Checkout Capability Module
 * 
 * Implements UCP Checkout using Wix eCommerce APIs.
 * Manages checkout sessions and cart operations.
 * 
 * See: .cursor/rules/modules/checkout.mdc
 */

// Types
export * from './types.js';

// State Machine
export * from './state-machine.js';

// Cart Mapper
export * from './cart-mapper.js';

// Pricing Engine
export * from './pricing-engine.js';

// Session Manager
export {
  CheckoutSessionManager,
  createSessionManager,
  getSessionManager,
  type SessionManagerConfig,
} from './session-manager.js';

// Main Service
export {
  CheckoutService,
  createCheckoutService,
  getCheckoutService,
} from './service.js';

// Schemas
export * from './schemas.js';

// Routes
export { checkoutRoutes } from './routes.js';
