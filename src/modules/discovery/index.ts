/**
 * Discovery Profile Module
 * 
 * Implements UCP business profile discovery.
 * Exposes /.well-known/ucp endpoint.
 * 
 * See: .cursor/rules/modules/discovery.mdc
 */

// Types
export * from './types.js';

// Profile Builder
export {
  UCPProfileBuilder,
  createProfileBuilder,
  applyProfileContext,
  createDefaultWixProfile,
} from './profile-builder.js';

// Capability Registry
export {
  CapabilityRegistry,
  getCapabilityRegistry,
  createCapabilityRegistry,
  registerDefaultCapabilities,
} from './capability-registry.js';

// Handler Registry
export {
  PaymentHandlerRegistry,
  getHandlerRegistry,
  createHandlerRegistry,
  registerWixPaymentsHandler,
  type HandlerFilterCriteria,
} from './handler-registry.js';

// Negotiation
export {
  negotiate,
  buildNegotiateResponse,
  validateAgentProfile,
  isViableForCheckout,
  getMinimumCheckoutRequirements,
  scoreNegotiation,
} from './negotiation.js';

// Routes
export { discoveryRoutes } from './routes.js';
