/**
 * Payment Handler Module (com.wix.payments)
 * 
 * Implements Wix Payments as UCP Payment Handler.
 * Handles tokenization, detokenization, and processing.
 * 
 * See: .cursor/rules/modules/payment-handler.mdc
 */

// Types
export * from './types.js';

// Configuration
export * from './config.js';

// Schemas
export * from './schemas.js';

// Services
export { PaymentTokenizer, createTokenizer } from './tokenizer.js';
export { PaymentDetokenizer, createDetokenizer } from './detokenizer.js';

// Main handler
export {
  WixPaymentsHandler,
  createWixPaymentsHandler,
  createDefaultHandler,
} from './handler.js';

// Routes
export { paymentHandlerRoutes } from './routes.js';
