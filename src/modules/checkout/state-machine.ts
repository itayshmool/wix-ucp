/**
 * Checkout State Machine
 * 
 * Manages checkout status transitions and validation.
 * See: .cursor/rules/modules/checkout.mdc
 */

import type { CheckoutStatus } from '../../core/types/checkout.js';
import type { CheckoutEvent, TransitionResult, StoredCheckoutSession } from './types.js';
import { logger } from '../../lib/logger.js';

/**
 * Valid state transitions map
 * 
 * Maps: current status -> event -> next status
 */
const STATE_TRANSITIONS: Record<CheckoutStatus, Partial<Record<CheckoutEvent, CheckoutStatus>>> = {
  incomplete: {
    BUYER_INFO_ADDED: 'incomplete',      // May still be incomplete
    SHIPPING_SELECTED: 'incomplete',     // May still be incomplete
    ALL_INFO_PROVIDED: 'ready_for_payment',
    CANCEL_CALLED: 'cancelled',
    EXPIRED: 'expired',
  },
  ready_for_payment: {
    BUYER_INFO_ADDED: 'ready_for_payment',
    SHIPPING_SELECTED: 'ready_for_payment',
    PAYMENT_SUBMITTED: 'ready_for_complete',
    ACTION_REQUIRED: 'requires_action',
    CANCEL_CALLED: 'cancelled',
    EXPIRED: 'expired',
  },
  ready_for_complete: {
    COMPLETE_CALLED: 'completed',
    ACTION_REQUIRED: 'requires_action',
    CANCEL_CALLED: 'cancelled',
    EXPIRED: 'expired',
  },
  requires_action: {
    ACTION_COMPLETED: 'ready_for_complete',
    CANCEL_CALLED: 'cancelled',
    EXPIRED: 'expired',
  },
  completed: {
    // Terminal state - no transitions
  },
  expired: {
    // Terminal state - no transitions
  },
  cancelled: {
    // Terminal state - no transitions
  },
};

/**
 * Terminal states that cannot transition
 */
export const TERMINAL_STATES: CheckoutStatus[] = ['completed', 'expired', 'cancelled'];

/**
 * States that allow modifications
 */
export const MODIFIABLE_STATES: CheckoutStatus[] = ['incomplete', 'ready_for_payment'];

/**
 * Check if a status is terminal (cannot transition)
 */
export function isTerminalState(status: CheckoutStatus): boolean {
  return TERMINAL_STATES.includes(status);
}

/**
 * Check if a checkout can be modified in its current state
 */
export function canModify(status: CheckoutStatus): boolean {
  return MODIFIABLE_STATES.includes(status);
}

/**
 * Attempt a state transition
 * 
 * @param currentStatus - Current checkout status
 * @param event - Event triggering the transition
 * @returns Transition result with new status or error
 */
export function transition(
  currentStatus: CheckoutStatus,
  event: CheckoutEvent
): TransitionResult {
  // Check if current state is terminal
  if (isTerminalState(currentStatus)) {
    return {
      valid: false,
      error: `Cannot transition from terminal state '${currentStatus}'`,
    };
  }

  // Get valid transitions for current status
  const validTransitions = STATE_TRANSITIONS[currentStatus];
  const newStatus = validTransitions?.[event];

  if (!newStatus) {
    return {
      valid: false,
      error: `Invalid transition: '${event}' is not allowed from state '${currentStatus}'`,
    };
  }

  logger.debug(
    { from: currentStatus, event, to: newStatus },
    'Checkout state transition'
  );

  return {
    valid: true,
    newStatus,
  };
}

/**
 * Get all valid events for a given status
 */
export function getValidEvents(status: CheckoutStatus): CheckoutEvent[] {
  const transitions = STATE_TRANSITIONS[status];
  return transitions ? (Object.keys(transitions) as CheckoutEvent[]) : [];
}

/**
 * Determine if all required info is provided for payment
 * 
 * @param session - Checkout session to evaluate
 * @returns Whether all required info is present
 */
export function isReadyForPayment(session: StoredCheckoutSession): boolean {
  // Must have buyer email
  if (!session.buyer?.email) {
    return false;
  }

  // Must have at least one line item
  if (!session.lineItems?.length) {
    return false;
  }

  // If has physical items, must have shipping selected
  const hasPhysicalItems = session.lineItems.some(
    item => !item.item.type || item.item.type !== 'digital'
  );
  
  if (hasPhysicalItems && !session.selectedFulfillmentId) {
    return false;
  }

  // If shipping selected, must have shipping address
  if (session.selectedFulfillmentId && !session.shippingAddress) {
    return false;
  }

  return true;
}

/**
 * Determine the appropriate status based on session state
 * 
 * @param session - Checkout session to evaluate
 * @returns Appropriate checkout status
 */
export function determineStatus(session: StoredCheckoutSession): CheckoutStatus {
  // Check for terminal states first
  if (session.status === 'completed' || 
      session.status === 'cancelled' || 
      session.status === 'expired') {
    return session.status;
  }

  // Check expiration
  if (new Date(session.expiresAt) < new Date()) {
    return 'expired';
  }

  // Check if ready for payment
  if (isReadyForPayment(session)) {
    // If payment was already submitted
    if (session.paymentTransactionId) {
      return 'ready_for_complete';
    }
    return 'ready_for_payment';
  }

  return 'incomplete';
}

/**
 * Get missing fields for checkout completion
 * 
 * @param session - Checkout session to check
 * @returns Array of missing field paths
 */
export function getMissingFields(session: StoredCheckoutSession): string[] {
  const missing: string[] = [];

  if (!session.buyer?.email) {
    missing.push('buyer.email');
  }

  if (!session.lineItems?.length) {
    missing.push('lineItems');
  }

  const hasPhysicalItems = session.lineItems?.some(
    item => !item.item.type || item.item.type !== 'digital'
  );

  if (hasPhysicalItems) {
    if (!session.selectedFulfillmentId) {
      missing.push('fulfillment.selectedId');
    }
    if (!session.shippingAddress) {
      missing.push('shippingAddress');
    }
  }

  return missing;
}

/**
 * Checkout State Machine class for managing session state
 */
export class CheckoutStateMachine {
  private status: CheckoutStatus;

  constructor(initialStatus: CheckoutStatus = 'incomplete') {
    this.status = initialStatus;
  }

  /**
   * Get current status
   */
  getStatus(): CheckoutStatus {
    return this.status;
  }

  /**
   * Check if in terminal state
   */
  isTerminal(): boolean {
    return isTerminalState(this.status);
  }

  /**
   * Check if modifications are allowed
   */
  canModify(): boolean {
    return canModify(this.status);
  }

  /**
   * Get valid events for current state
   */
  getValidEvents(): CheckoutEvent[] {
    return getValidEvents(this.status);
  }

  /**
   * Attempt to transition to a new state
   * 
   * @param event - Event triggering the transition
   * @returns Whether the transition was successful
   */
  dispatch(event: CheckoutEvent): TransitionResult {
    const result = transition(this.status, event);
    
    if (result.valid && result.newStatus) {
      this.status = result.newStatus;
    }

    return result;
  }

  /**
   * Force set status (use with caution, bypasses validation)
   */
  forceStatus(status: CheckoutStatus): void {
    logger.warn(
      { from: this.status, to: status },
      'Forcing checkout status change'
    );
    this.status = status;
  }
}

/**
 * Create a new state machine instance
 */
export function createStateMachine(
  initialStatus: CheckoutStatus = 'incomplete'
): CheckoutStateMachine {
  return new CheckoutStateMachine(initialStatus);
}
