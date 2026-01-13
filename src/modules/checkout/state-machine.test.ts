/**
 * Checkout State Machine Tests
 * 
 * Unit tests for checkout status transitions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CheckoutStateMachine,
  createStateMachine,
  transition,
  isTerminalState,
  canModify,
  getValidEvents,
  isReadyForPayment,
  determineStatus,
  getMissingFields,
  TERMINAL_STATES,
  MODIFIABLE_STATES,
} from './state-machine.js';
import type { StoredCheckoutSession } from './types.js';

describe('Checkout State Machine', () => {
  describe('transition function', () => {
    it('should transition from incomplete to ready_for_payment', () => {
      const result = transition('incomplete', 'ALL_INFO_PROVIDED');
      expect(result.valid).toBe(true);
      expect(result.newStatus).toBe('ready_for_payment');
    });

    it('should transition from ready_for_payment to ready_for_complete', () => {
      const result = transition('ready_for_payment', 'PAYMENT_SUBMITTED');
      expect(result.valid).toBe(true);
      expect(result.newStatus).toBe('ready_for_complete');
    });

    it('should transition from ready_for_complete to completed', () => {
      const result = transition('ready_for_complete', 'COMPLETE_CALLED');
      expect(result.valid).toBe(true);
      expect(result.newStatus).toBe('completed');
    });

    it('should allow cancellation from incomplete', () => {
      const result = transition('incomplete', 'CANCEL_CALLED');
      expect(result.valid).toBe(true);
      expect(result.newStatus).toBe('cancelled');
    });

    it('should allow cancellation from ready_for_payment', () => {
      const result = transition('ready_for_payment', 'CANCEL_CALLED');
      expect(result.valid).toBe(true);
      expect(result.newStatus).toBe('cancelled');
    });

    it('should handle expiration from any non-terminal state', () => {
      expect(transition('incomplete', 'EXPIRED').newStatus).toBe('expired');
      expect(transition('ready_for_payment', 'EXPIRED').newStatus).toBe('expired');
      expect(transition('ready_for_complete', 'EXPIRED').newStatus).toBe('expired');
      expect(transition('requires_action', 'EXPIRED').newStatus).toBe('expired');
    });

    it('should handle 3DS/action required flow', () => {
      const actionRequired = transition('ready_for_payment', 'ACTION_REQUIRED');
      expect(actionRequired.valid).toBe(true);
      expect(actionRequired.newStatus).toBe('requires_action');

      const actionCompleted = transition('requires_action', 'ACTION_COMPLETED');
      expect(actionCompleted.valid).toBe(true);
      expect(actionCompleted.newStatus).toBe('ready_for_complete');
    });

    it('should reject invalid transitions', () => {
      const result = transition('incomplete', 'COMPLETE_CALLED');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should reject transitions from terminal states', () => {
      const fromCompleted = transition('completed', 'CANCEL_CALLED');
      expect(fromCompleted.valid).toBe(false);
      expect(fromCompleted.error).toContain('terminal state');

      const fromCancelled = transition('cancelled', 'ALL_INFO_PROVIDED');
      expect(fromCancelled.valid).toBe(false);

      const fromExpired = transition('expired', 'BUYER_INFO_ADDED');
      expect(fromExpired.valid).toBe(false);
    });
  });

  describe('isTerminalState', () => {
    it('should identify terminal states', () => {
      expect(isTerminalState('completed')).toBe(true);
      expect(isTerminalState('cancelled')).toBe(true);
      expect(isTerminalState('expired')).toBe(true);
    });

    it('should identify non-terminal states', () => {
      expect(isTerminalState('incomplete')).toBe(false);
      expect(isTerminalState('ready_for_payment')).toBe(false);
      expect(isTerminalState('ready_for_complete')).toBe(false);
      expect(isTerminalState('requires_action')).toBe(false);
    });
  });

  describe('canModify', () => {
    it('should allow modification in modifiable states', () => {
      expect(canModify('incomplete')).toBe(true);
      expect(canModify('ready_for_payment')).toBe(true);
    });

    it('should deny modification in non-modifiable states', () => {
      expect(canModify('ready_for_complete')).toBe(false);
      expect(canModify('completed')).toBe(false);
      expect(canModify('cancelled')).toBe(false);
      expect(canModify('expired')).toBe(false);
    });
  });

  describe('getValidEvents', () => {
    it('should return valid events for incomplete', () => {
      const events = getValidEvents('incomplete');
      expect(events).toContain('ALL_INFO_PROVIDED');
      expect(events).toContain('CANCEL_CALLED');
      expect(events).toContain('EXPIRED');
    });

    it('should return valid events for ready_for_payment', () => {
      const events = getValidEvents('ready_for_payment');
      expect(events).toContain('PAYMENT_SUBMITTED');
      expect(events).toContain('ACTION_REQUIRED');
    });

    it('should return empty array for terminal states', () => {
      expect(getValidEvents('completed')).toEqual([]);
      expect(getValidEvents('cancelled')).toEqual([]);
      expect(getValidEvents('expired')).toEqual([]);
    });
  });

  describe('CheckoutStateMachine class', () => {
    let stateMachine: CheckoutStateMachine;

    beforeEach(() => {
      stateMachine = createStateMachine();
    });

    it('should start with incomplete status', () => {
      expect(stateMachine.getStatus()).toBe('incomplete');
    });

    it('should start with custom initial status', () => {
      const sm = createStateMachine('ready_for_payment');
      expect(sm.getStatus()).toBe('ready_for_payment');
    });

    it('should dispatch events and update status', () => {
      const result = stateMachine.dispatch('ALL_INFO_PROVIDED');
      expect(result.valid).toBe(true);
      expect(stateMachine.getStatus()).toBe('ready_for_payment');
    });

    it('should chain transitions correctly', () => {
      stateMachine.dispatch('ALL_INFO_PROVIDED');
      expect(stateMachine.getStatus()).toBe('ready_for_payment');

      stateMachine.dispatch('PAYMENT_SUBMITTED');
      expect(stateMachine.getStatus()).toBe('ready_for_complete');

      stateMachine.dispatch('COMPLETE_CALLED');
      expect(stateMachine.getStatus()).toBe('completed');
    });

    it('should not change status on invalid transition', () => {
      const result = stateMachine.dispatch('COMPLETE_CALLED');
      expect(result.valid).toBe(false);
      expect(stateMachine.getStatus()).toBe('incomplete');
    });

    it('should report terminal state correctly', () => {
      expect(stateMachine.isTerminal()).toBe(false);

      stateMachine.dispatch('CANCEL_CALLED');
      expect(stateMachine.isTerminal()).toBe(true);
    });

    it('should report modification capability', () => {
      expect(stateMachine.canModify()).toBe(true);

      stateMachine.dispatch('ALL_INFO_PROVIDED');
      expect(stateMachine.canModify()).toBe(true);

      stateMachine.dispatch('PAYMENT_SUBMITTED');
      expect(stateMachine.canModify()).toBe(false);
    });
  });

  describe('Session readiness checks', () => {
    const baseSession: StoredCheckoutSession = {
      id: 'checkout_123',
      status: 'incomplete',
      currency: 'USD',
      lineItems: [
        {
          id: 'item_1',
          item: { id: 'prod_1', title: 'Test Product', price: { amount: 1000, currency: 'USD' } },
          quantity: 1,
          totalPrice: { amount: 1000, currency: 'USD' },
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };

    describe('isReadyForPayment', () => {
      it('should return false without buyer email', () => {
        const session = { ...baseSession };
        expect(isReadyForPayment(session)).toBe(false);
      });

      it('should return false without line items', () => {
        const session = { 
          ...baseSession, 
          buyer: { email: 'test@example.com' },
          lineItems: [],
        };
        expect(isReadyForPayment(session)).toBe(false);
      });

      it('should return false for physical items without shipping', () => {
        const session = { 
          ...baseSession, 
          buyer: { email: 'test@example.com' },
        };
        expect(isReadyForPayment(session)).toBe(false);
      });

      it('should return true with all required info', () => {
        const session = { 
          ...baseSession, 
          buyer: { email: 'test@example.com' },
          selectedFulfillmentId: 'shipping_1',
          shippingAddress: {
            line1: '123 Main St',
            city: 'NYC',
            country: 'US',
            postalCode: '10001',
          },
        };
        expect(isReadyForPayment(session)).toBe(true);
      });

      it('should return true for digital-only items without shipping', () => {
        const session = { 
          ...baseSession, 
          buyer: { email: 'test@example.com' },
          lineItems: [
            {
              id: 'item_1',
              item: { id: 'prod_1', title: 'Digital Product', price: { amount: 500, currency: 'USD' }, type: 'digital' },
              quantity: 1,
              totalPrice: { amount: 500, currency: 'USD' },
            },
          ],
        };
        expect(isReadyForPayment(session)).toBe(true);
      });
    });

    describe('determineStatus', () => {
      it('should return expired for past expiration', () => {
        const session = { 
          ...baseSession,
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        };
        expect(determineStatus(session)).toBe('expired');
      });

      it('should preserve terminal states', () => {
        expect(determineStatus({ ...baseSession, status: 'completed' })).toBe('completed');
        expect(determineStatus({ ...baseSession, status: 'cancelled' })).toBe('cancelled');
      });

      it('should return incomplete when missing info', () => {
        expect(determineStatus(baseSession)).toBe('incomplete');
      });

      it('should return ready_for_payment when all info provided', () => {
        const session = { 
          ...baseSession, 
          buyer: { email: 'test@example.com' },
          selectedFulfillmentId: 'shipping_1',
          shippingAddress: {
            line1: '123 Main St',
            city: 'NYC',
            country: 'US',
            postalCode: '10001',
          },
        };
        expect(determineStatus(session)).toBe('ready_for_payment');
      });

      it('should return ready_for_complete when payment submitted', () => {
        const session = { 
          ...baseSession, 
          buyer: { email: 'test@example.com' },
          selectedFulfillmentId: 'shipping_1',
          shippingAddress: {
            line1: '123 Main St',
            city: 'NYC',
            country: 'US',
            postalCode: '10001',
          },
          paymentTransactionId: 'txn_123',
        };
        expect(determineStatus(session)).toBe('ready_for_complete');
      });
    });

    describe('getMissingFields', () => {
      it('should identify missing email', () => {
        const missing = getMissingFields(baseSession);
        expect(missing).toContain('buyer.email');
      });

      it('should identify missing fulfillment', () => {
        const session = { 
          ...baseSession, 
          buyer: { email: 'test@example.com' },
        };
        const missing = getMissingFields(session);
        expect(missing).toContain('fulfillment.selectedId');
      });

      it('should identify missing shipping address', () => {
        const session = { 
          ...baseSession, 
          buyer: { email: 'test@example.com' },
          selectedFulfillmentId: 'shipping_1',
        };
        const missing = getMissingFields(session);
        expect(missing).toContain('shippingAddress');
      });

      it('should return empty array when complete', () => {
        const session = { 
          ...baseSession, 
          buyer: { email: 'test@example.com' },
          selectedFulfillmentId: 'shipping_1',
          shippingAddress: {
            line1: '123 Main St',
            city: 'NYC',
            country: 'US',
            postalCode: '10001',
          },
        };
        const missing = getMissingFields(session);
        expect(missing).toEqual([]);
      });
    });
  });
});
