/**
 * Order Management Tests
 * 
 * Unit tests for order types, state machine, mappers, and service.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  // State machine functions
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
import {
  mapWixOrderToUCP,
  mapWixOrderToSummary,
  mapWixFulfillmentsToShipments,
  generateOrderLinks,
  type WixOrder,
} from './mappers.js';
import {
  ORDERS_CAPABILITY,
  ORDER_CACHE_TTL,
  DEFAULT_RETURN_POLICY,
} from './types.js';
import type { OrderStatus, PaymentStatus, ShipmentStatus, ReturnStatus } from './types.js';

// ─────────────────────────────────────────────────────────────
// Types and Constants Tests
// ─────────────────────────────────────────────────────────────

describe('Order Module', () => {
  describe('Constants', () => {
    it('should have correct capability declaration', () => {
      expect(ORDERS_CAPABILITY.name).toBe('dev.ucp.shopping.orders');
      expect(ORDERS_CAPABILITY.version).toBe('2026-01-11');
      expect(ORDERS_CAPABILITY.spec).toBe('https://ucp.dev/specification/orders');
    });

    it('should have cache TTLs for all order statuses', () => {
      expect(ORDER_CACHE_TTL.pending).toBe(60);
      expect(ORDER_CACHE_TTL.confirmed).toBe(120);
      expect(ORDER_CACHE_TTL.processing).toBe(300);
      expect(ORDER_CACHE_TTL.shipped).toBe(300);
      expect(ORDER_CACHE_TTL.delivered).toBe(3600);
      expect(ORDER_CACHE_TTL.cancelled).toBe(86400);
      expect(ORDER_CACHE_TTL.returned).toBe(86400);
    });

    it('should have default return policy', () => {
      expect(DEFAULT_RETURN_POLICY.windowDays).toBe(30);
      expect(DEFAULT_RETURN_POLICY.restockingFee).toBe(0);
      expect(DEFAULT_RETURN_POLICY.requiresLabel).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Order State Machine Tests
  // ─────────────────────────────────────────────────────────────

  describe('Order State Machine', () => {
    describe('isValidOrderTransition', () => {
      it('should allow pending -> confirmed', () => {
        expect(isValidOrderTransition('pending', 'confirmed')).toBe(true);
      });

      it('should allow pending -> cancelled', () => {
        expect(isValidOrderTransition('pending', 'cancelled')).toBe(true);
      });

      it('should allow confirmed -> processing', () => {
        expect(isValidOrderTransition('confirmed', 'processing')).toBe(true);
      });

      it('should allow processing -> shipped', () => {
        expect(isValidOrderTransition('processing', 'shipped')).toBe(true);
      });

      it('should allow shipped -> delivered', () => {
        expect(isValidOrderTransition('shipped', 'delivered')).toBe(true);
      });

      it('should allow delivered -> returned', () => {
        expect(isValidOrderTransition('delivered', 'returned')).toBe(true);
      });

      it('should not allow skipping states', () => {
        expect(isValidOrderTransition('pending', 'shipped')).toBe(false);
      });

      it('should not allow backward transitions', () => {
        expect(isValidOrderTransition('shipped', 'processing')).toBe(false);
      });

      it('should not allow transitions from terminal states', () => {
        expect(isValidOrderTransition('cancelled', 'pending')).toBe(false);
        expect(isValidOrderTransition('returned', 'delivered')).toBe(false);
      });
    });

    describe('getValidOrderTransitions', () => {
      it('should return valid transitions for pending', () => {
        const transitions = getValidOrderTransitions('pending');
        expect(transitions).toContain('confirmed');
        expect(transitions).toContain('cancelled');
      });

      it('should return empty array for terminal states', () => {
        expect(getValidOrderTransitions('cancelled')).toEqual([]);
        expect(getValidOrderTransitions('returned')).toEqual([]);
      });
    });

    describe('isTerminalOrderStatus', () => {
      it('should identify terminal states', () => {
        expect(isTerminalOrderStatus('cancelled')).toBe(true);
        expect(isTerminalOrderStatus('returned')).toBe(true);
      });

      it('should not identify non-terminal states', () => {
        expect(isTerminalOrderStatus('pending')).toBe(false);
        expect(isTerminalOrderStatus('shipped')).toBe(false);
        expect(isTerminalOrderStatus('delivered')).toBe(false);
      });
    });

    describe('canCancelOrder', () => {
      it('should allow cancellation for pending/confirmed/processing', () => {
        expect(canCancelOrder('pending')).toBe(true);
        expect(canCancelOrder('confirmed')).toBe(true);
        expect(canCancelOrder('processing')).toBe(true);
      });

      it('should not allow cancellation after shipping', () => {
        expect(canCancelOrder('shipped')).toBe(false);
        expect(canCancelOrder('delivered')).toBe(false);
      });
    });

    describe('canReturnOrder', () => {
      it('should only allow returns for delivered orders', () => {
        expect(canReturnOrder('delivered')).toBe(true);
        expect(canReturnOrder('shipped')).toBe(false);
        expect(canReturnOrder('pending')).toBe(false);
      });
    });

    describe('isFulfilledOrder', () => {
      it('should identify fulfilled orders', () => {
        expect(isFulfilledOrder('shipped')).toBe(true);
        expect(isFulfilledOrder('delivered')).toBe(true);
        expect(isFulfilledOrder('returned')).toBe(true);
      });

      it('should not identify unfulfilled orders', () => {
        expect(isFulfilledOrder('pending')).toBe(false);
        expect(isFulfilledOrder('processing')).toBe(false);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Payment State Machine Tests
  // ─────────────────────────────────────────────────────────────

  describe('Payment State Machine', () => {
    describe('isValidPaymentTransition', () => {
      it('should allow pending -> captured', () => {
        expect(isValidPaymentTransition('pending', 'captured')).toBe(true);
      });

      it('should allow captured -> partially_refunded', () => {
        expect(isValidPaymentTransition('captured', 'partially_refunded')).toBe(true);
      });

      it('should allow partially_refunded -> refunded', () => {
        expect(isValidPaymentTransition('partially_refunded', 'refunded')).toBe(true);
      });

      it('should not allow backward transitions', () => {
        expect(isValidPaymentTransition('captured', 'pending')).toBe(false);
      });
    });

    describe('isPaymentComplete', () => {
      it('should identify captured as complete', () => {
        expect(isPaymentComplete('captured')).toBe(true);
      });

      it('should not identify pending as complete', () => {
        expect(isPaymentComplete('pending')).toBe(false);
      });
    });

    describe('hasRefund', () => {
      it('should identify refunded payments', () => {
        expect(hasRefund('partially_refunded')).toBe(true);
        expect(hasRefund('refunded')).toBe(true);
      });

      it('should not identify non-refunded payments', () => {
        expect(hasRefund('captured')).toBe(false);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Shipment State Machine Tests
  // ─────────────────────────────────────────────────────────────

  describe('Shipment State Machine', () => {
    describe('isValidShipmentTransition', () => {
      it('should allow normal progression', () => {
        expect(isValidShipmentTransition('label_created', 'picked_up')).toBe(true);
        expect(isValidShipmentTransition('picked_up', 'in_transit')).toBe(true);
        expect(isValidShipmentTransition('in_transit', 'out_for_delivery')).toBe(true);
        expect(isValidShipmentTransition('out_for_delivery', 'delivered')).toBe(true);
      });

      it('should allow exception transitions', () => {
        expect(isValidShipmentTransition('in_transit', 'exception')).toBe(true);
      });

      it('should allow recovery from exception', () => {
        expect(isValidShipmentTransition('exception', 'in_transit')).toBe(true);
      });
    });

    describe('isShipmentInProgress', () => {
      it('should identify in-progress shipments', () => {
        expect(isShipmentInProgress('picked_up')).toBe(true);
        expect(isShipmentInProgress('in_transit')).toBe(true);
        expect(isShipmentInProgress('out_for_delivery')).toBe(true);
      });

      it('should not identify non-in-progress shipments', () => {
        expect(isShipmentInProgress('label_created')).toBe(false);
        expect(isShipmentInProgress('delivered')).toBe(false);
      });
    });

    describe('isShipmentDelivered', () => {
      it('should identify delivered shipments', () => {
        expect(isShipmentDelivered('delivered')).toBe(true);
      });

      it('should not identify non-delivered shipments', () => {
        expect(isShipmentDelivered('in_transit')).toBe(false);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Return State Machine Tests
  // ─────────────────────────────────────────────────────────────

  describe('Return State Machine', () => {
    describe('isValidReturnTransition', () => {
      it('should allow requested -> approved', () => {
        expect(isValidReturnTransition('requested', 'approved')).toBe(true);
      });

      it('should allow requested -> rejected', () => {
        expect(isValidReturnTransition('requested', 'rejected')).toBe(true);
      });

      it('should allow approved -> in_transit', () => {
        expect(isValidReturnTransition('approved', 'in_transit')).toBe(true);
      });

      it('should allow received -> refunded', () => {
        expect(isValidReturnTransition('received', 'refunded')).toBe(true);
      });
    });

    describe('isReturnPendingApproval', () => {
      it('should identify pending returns', () => {
        expect(isReturnPendingApproval('requested')).toBe(true);
      });

      it('should not identify approved returns', () => {
        expect(isReturnPendingApproval('approved')).toBe(false);
      });
    });

    describe('isReturnComplete', () => {
      it('should identify complete returns', () => {
        expect(isReturnComplete('rejected')).toBe(true);
        expect(isReturnComplete('refunded')).toBe(true);
      });

      it('should not identify in-progress returns', () => {
        expect(isReturnComplete('in_transit')).toBe(false);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Status Mapping Tests
  // ─────────────────────────────────────────────────────────────

  describe('Status Mapping', () => {
    describe('mapWixOrderStatus', () => {
      it('should map CANCELED to cancelled', () => {
        expect(mapWixOrderStatus('CANCELED', 'PAID', 'NOT_FULFILLED')).toBe('cancelled');
      });

      it('should map FULFILLED to delivered', () => {
        expect(mapWixOrderStatus('APPROVED', 'PAID', 'FULFILLED')).toBe('delivered');
      });

      it('should map PARTIALLY_FULFILLED to shipped', () => {
        expect(mapWixOrderStatus('APPROVED', 'PAID', 'PARTIALLY_FULFILLED')).toBe('shipped');
      });

      it('should map PAID + NOT_FULFILLED to confirmed', () => {
        expect(mapWixOrderStatus('APPROVED', 'PAID', 'NOT_FULFILLED')).toBe('confirmed');
      });

      it('should map NOT_PAID to pending', () => {
        expect(mapWixOrderStatus('APPROVED', 'NOT_PAID', 'NOT_FULFILLED')).toBe('pending');
      });
    });

    describe('mapWixPaymentStatus', () => {
      it('should map PAID to captured', () => {
        expect(mapWixPaymentStatus('PAID')).toBe('captured');
      });

      it('should map NOT_PAID to pending', () => {
        expect(mapWixPaymentStatus('NOT_PAID')).toBe('pending');
      });

      it('should map REFUNDED to refunded', () => {
        expect(mapWixPaymentStatus('REFUNDED')).toBe('refunded');
      });
    });

    describe('mapWixFulfillmentStatus', () => {
      it('should map FULFILLED to delivered', () => {
        expect(mapWixFulfillmentStatus('FULFILLED')).toBe('delivered');
      });

      it('should map PARTIALLY_FULFILLED to in_transit', () => {
        expect(mapWixFulfillmentStatus('PARTIALLY_FULFILLED')).toBe('in_transit');
      });

      it('should map NOT_FULFILLED to label_created', () => {
        expect(mapWixFulfillmentStatus('NOT_FULFILLED')).toBe('label_created');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Status Display Tests
  // ─────────────────────────────────────────────────────────────

  describe('Status Display', () => {
    describe('getOrderStatusLabel', () => {
      it('should return human-readable labels', () => {
        expect(getOrderStatusLabel('pending')).toBe('Order Placed');
        expect(getOrderStatusLabel('confirmed')).toBe('Payment Confirmed');
        expect(getOrderStatusLabel('shipped')).toBe('Shipped');
        expect(getOrderStatusLabel('delivered')).toBe('Delivered');
        expect(getOrderStatusLabel('cancelled')).toBe('Cancelled');
      });
    });

    describe('getOrderStatusColor', () => {
      it('should return appropriate colors', () => {
        expect(getOrderStatusColor('pending')).toBe('yellow');
        expect(getOrderStatusColor('shipped')).toBe('purple');
        expect(getOrderStatusColor('delivered')).toBe('green');
        expect(getOrderStatusColor('cancelled')).toBe('red');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Mapper Tests
  // ─────────────────────────────────────────────────────────────

  describe('Order Mappers', () => {
    const mockWixOrder: WixOrder = {
      id: 'order_123',
      number: '1001',
      status: 'APPROVED',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'FULFILLED',
      buyerInfo: {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
      },
      lineItems: [
        {
          id: 'li_1',
          productName: { original: 'Test Product' },
          quantity: 2,
          price: '25.00',
          totalPrice: '50.00',
          catalogReference: { catalogItemId: 'prod_123' },
        },
      ],
      totals: {
        subtotal: '50.00',
        shipping: '5.99',
        tax: '4.48',
        total: '60.47',
      },
      currency: 'USD',
      createdDate: '2026-01-14T10:00:00Z',
      updatedDate: '2026-01-14T12:00:00Z',
    };

    describe('mapWixOrderToUCP', () => {
      it('should map order ID and number', () => {
        const order = mapWixOrderToUCP(mockWixOrder);
        
        expect(order.id).toBe('order_123');
        expect(order.confirmationNumber).toBe('1001');
      });

      it('should map status correctly', () => {
        const order = mapWixOrderToUCP(mockWixOrder);
        
        expect(order.status).toBe('delivered');
      });

      it('should map buyer info', () => {
        const order = mapWixOrderToUCP(mockWixOrder);
        
        expect(order.buyer.email).toBe('test@example.com');
        expect(order.buyer.firstName).toBe('John');
        expect(order.buyer.lastName).toBe('Doe');
      });

      it('should map line items', () => {
        const order = mapWixOrderToUCP(mockWixOrder);
        
        expect(order.lineItems).toHaveLength(1);
        expect(order.lineItems[0].name).toBe('Test Product');
        expect(order.lineItems[0].quantity).toBe(2);
        expect(order.lineItems[0].unitPrice.amount).toBe(2500);
      });

      it('should map totals', () => {
        const order = mapWixOrderToUCP(mockWixOrder);
        
        const subtotal = order.totals.find(t => t.type === 'SUBTOTAL');
        const total = order.totals.find(t => t.type === 'TOTAL');
        
        expect(subtotal?.amount).toBe(5000);
        expect(total?.amount).toBe(6047);
      });

      it('should include HATEOAS links', () => {
        const order = mapWixOrderToUCP(mockWixOrder);
        
        expect(order.links.some(l => l.rel === 'self')).toBe(true);
        expect(order.links.some(l => l.rel === 'tracking')).toBe(true);
        expect(order.links.some(l => l.rel === 'return')).toBe(true);
      });
    });

    describe('mapWixOrderToSummary', () => {
      it('should map basic order info', () => {
        const summary = mapWixOrderToSummary(mockWixOrder);
        
        expect(summary.id).toBe('order_123');
        expect(summary.confirmationNumber).toBe('1001');
        expect(summary.status).toBe('delivered');
      });

      it('should calculate item count', () => {
        const summary = mapWixOrderToSummary(mockWixOrder);
        
        expect(summary.itemCount).toBe(2);
      });

      it('should map total amount', () => {
        const summary = mapWixOrderToSummary(mockWixOrder);
        
        expect(summary.total.amount).toBe(6047);
        expect(summary.total.currency).toBe('USD');
      });
    });

    describe('generateOrderLinks', () => {
      it('should generate correct links', () => {
        const links = generateOrderLinks('order_123', 'https://api.example.com');
        
        expect(links).toHaveLength(3);
        expect(links[0].rel).toBe('self');
        expect(links[0].href).toBe('https://api.example.com/ucp/v1/orders/order_123');
        expect(links[1].rel).toBe('tracking');
        expect(links[2].rel).toBe('return');
      });
    });

    describe('mapWixFulfillmentsToShipments', () => {
      it('should return empty array for undefined fulfillments', () => {
        expect(mapWixFulfillmentsToShipments(undefined)).toEqual([]);
      });

      it('should return empty array for empty fulfillments', () => {
        expect(mapWixFulfillmentsToShipments([])).toEqual([]);
      });

      it('should map fulfillments to shipments', () => {
        const fulfillments = [
          {
            id: 'ful_1',
            trackingInfo: {
              shippingProvider: 'UPS',
              trackingNumber: '1Z999AA10123456784',
              trackingLink: 'https://ups.com/track/1Z999AA10123456784',
            },
            lineItems: [{ id: 'li_1', quantity: 1 }],
          },
        ];

        const shipments = mapWixFulfillmentsToShipments(fulfillments);
        
        expect(shipments).toHaveLength(1);
        expect(shipments[0].carrier).toBe('UPS');
        expect(shipments[0].trackingNumber).toBe('1Z999AA10123456784');
        expect(shipments[0].items).toEqual(['li_1']);
      });
    });
  });
});
