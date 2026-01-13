/**
 * Capability Negotiation
 * 
 * Implements agent-business capability negotiation.
 * See: .cursor/rules/modules/discovery.mdc
 */

import { logger } from '../../lib/logger.js';
import type {
  UCPProfile,
  AgentProfile,
  NegotiateResponse,
  Capability,
  Extension,
} from './types.js';
import type { PaymentHandler } from '../../core/types/payment.js';

/**
 * Internal negotiation result
 */
interface NegotiationResult {
  capabilities: Capability[];
  handlers: PaymentHandler[];
  extensions: Extension[];
  warnings: string[];
}

/**
 * Negotiate capabilities between agent and business
 * 
 * Finds the intersection of supported features between what the
 * business offers and what the agent can use.
 */
export function negotiate(
  businessProfile: UCPProfile,
  agentProfile: AgentProfile
): NegotiationResult {
  const warnings: string[] = [];

  // Find intersection of capabilities
  const capabilities = businessProfile.capabilities.filter(
    (cap) => agentProfile.capabilities.includes(cap.name)
  );

  if (capabilities.length === 0) {
    warnings.push('No common capabilities found');
    logger.warn(
      {
        businessCapabilities: businessProfile.capabilities.map((c) => c.name),
        agentCapabilities: agentProfile.capabilities,
      },
      'Negotiation: No common capabilities'
    );
  }

  // Find compatible handlers
  const handlers = businessProfile.payment.handlers.filter(
    (handler) => agentProfile.handlers.includes(handler.name)
  );

  if (handlers.length === 0) {
    warnings.push('No compatible payment handlers found');
    logger.warn(
      {
        businessHandlers: businessProfile.payment.handlers.map((h) => h.name),
        agentHandlers: agentProfile.handlers,
      },
      'Negotiation: No compatible handlers'
    );
  }

  // Find shared extensions
  const businessExtensions = businessProfile.extensions ?? [];
  const extensions = businessExtensions.filter(
    (ext) => agentProfile.extensions.includes(ext.name)
  );

  logger.info(
    {
      negotiated: {
        capabilities: capabilities.length,
        handlers: handlers.length,
        extensions: extensions.length,
      },
      warnings: warnings.length,
    },
    'Negotiation completed'
  );

  return {
    capabilities,
    handlers,
    extensions,
    warnings,
  };
}

/**
 * Build negotiation response from result
 */
export function buildNegotiateResponse(
  result: NegotiationResult
): NegotiateResponse {
  return {
    negotiated: {
      capabilities: result.capabilities,
      handlers: result.handlers,
      extensions: result.extensions,
    },
    warnings: result.warnings.length > 0 ? result.warnings : undefined,
  };
}

/**
 * Validate agent profile
 */
export function validateAgentProfile(profile: AgentProfile): string[] {
  const errors: string[] = [];

  if (!Array.isArray(profile.capabilities)) {
    errors.push('capabilities must be an array');
  }

  if (!Array.isArray(profile.handlers)) {
    errors.push('handlers must be an array');
  }

  if (!Array.isArray(profile.extensions)) {
    errors.push('extensions must be an array');
  }

  return errors;
}

/**
 * Check if negotiation result is viable for checkout
 * 
 * A viable result has at least the checkout capability and one handler.
 */
export function isViableForCheckout(result: NegotiationResult): boolean {
  const hasCheckout = result.capabilities.some(
    (cap) => cap.name === 'dev.ucp.shopping.checkout'
  );

  const hasHandler = result.handlers.length > 0;

  return hasCheckout && hasHandler;
}

/**
 * Get minimum required capabilities for checkout
 */
export function getMinimumCheckoutRequirements(): {
  capabilities: string[];
  handlers: string[];
} {
  return {
    capabilities: ['dev.ucp.shopping.checkout'],
    handlers: ['com.wix.payments'],
  };
}

/**
 * Score the negotiation result (for ranking multiple profiles)
 * 
 * Higher score = better compatibility
 */
export function scoreNegotiation(result: NegotiationResult): number {
  let score = 0;

  // Each capability is worth 10 points
  score += result.capabilities.length * 10;

  // Each handler is worth 5 points
  score += result.handlers.length * 5;

  // Each extension is worth 2 points
  score += result.extensions.length * 2;

  // Bonus for checkout capability
  if (result.capabilities.some((c) => c.name === 'dev.ucp.shopping.checkout')) {
    score += 20;
  }

  // Bonus for orders capability
  if (result.capabilities.some((c) => c.name === 'dev.ucp.shopping.orders')) {
    score += 10;
  }

  // Penalty for each warning
  score -= result.warnings.length * 5;

  return Math.max(0, score);
}
