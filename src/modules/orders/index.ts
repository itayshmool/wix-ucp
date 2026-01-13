/**
 * Order Management Module
 * 
 * Implements UCP Order Management capability.
 * Handles order tracking, returns, webhooks.
 * 
 * See: .cursor/rules/modules/orders.mdc
 */

// Types
export * from './types.js';

// State Machine
export {
  isValidOrderTransition,
  getValidOrderTransitions,
  isTerminalOrderStatus,
  canCancelOrder,
  canReturnOrder,
  isFulfilledOrder,
  isValidPaymentTransition,
  isPaymentComplete,
  hasRefund,
  isValidShipmentTransition,
  isShipmentInProgress,
  isShipmentDelivered,
  isValidReturnTransition,
  isReturnPendingApproval,
  isReturnComplete,
  mapWixOrderStatus,
  mapWixPaymentStatus,
  mapWixFulfillmentStatus,
  getOrderStatusLabel,
  getOrderStatusColor,
} from './state-machine.js';

// Mappers
export {
  mapWixOrderToUCP,
  mapWixOrderToSummary,
  mapWixFulfillmentsToShipments,
  generateOrderLinks,
  type WixOrder,
} from './mappers.js';

// Service
export {
  OrderService,
  createOrderService,
} from './service.js';

// Routes
export { orderRoutes } from './routes.js';
