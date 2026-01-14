/**
 * Checkout Service
 * 
 * Main service for checkout operations.
 * See: .cursor/rules/modules/checkout.mdc
 */

import { logger } from '../../lib/logger.js';
import { UCPException } from '../../core/types/errors.js';
import type { LineItem, Buyer, Address, Total } from '../../core/types/ucp-common.js';
import type { PaymentHandler } from '../../core/types/payment.js';
import { getWixEcommerceClient } from '../../adapters/wix/ecommerce.js';
import type {
  CreateCheckoutPayload,
  UpdateCheckoutPayload,
  CompleteCheckoutPayload,
  CheckoutResponse,
  CompleteCheckoutResponse,
  FulfillmentOption,
  FulfillmentInfo,
  StoredCheckoutSession,
} from './types.js';
import {
  CheckoutSessionManager,
  createSessionManager,
  getSessionManager,
} from './session-manager.js';
import {
  buildUCPHeader,
  generateLinks,
  generateMessages,
  hasPhysicalItems,
} from './cart-mapper.js';
import { recalculateTotals, validateDiscountCode } from './pricing-engine.js';
import { canModify, isTerminalState, getMissingFields } from './state-machine.js';
import { createDefaultHandler } from '../payment-handler/handler.js';

/**
 * Checkout Service
 */
export class CheckoutService {
  private sessionManager: CheckoutSessionManager;
  private paymentHandler: ReturnType<typeof createDefaultHandler>;

  constructor(sessionManager?: CheckoutSessionManager) {
    this.sessionManager = sessionManager ?? getSessionManager();
    this.paymentHandler = createDefaultHandler();
  }

  /**
   * Create a new checkout session
   */
  async createCheckout(payload: CreateCheckoutPayload): Promise<CheckoutResponse> {
    logger.info(
      { currency: payload.currency, itemCount: payload.lineItems.length },
      'Creating checkout session'
    );

    // Map payload line items to UCP format
    const lineItems: LineItem[] = payload.lineItems.map((item, index) => ({
      id: `item_${index}`,
      item: {
        id: item.catalogReference.catalogItemId,
        title: `Product ${item.catalogReference.catalogItemId}`,
        price: 0, // Will be populated from Wix API
      },
      quantity: item.quantity,
      totalPrice: 0,
    }));

    // Build buyer info
    const buyer: Buyer | undefined = payload.buyer
      ? {
          email: payload.buyer.email,
          firstName: payload.buyer.firstName,
          lastName: payload.buyer.lastName,
          phone: payload.buyer.phone,
        }
      : undefined;

    // Create session
    const session = await this.sessionManager.create({
      currency: payload.currency,
      buyer,
      lineItems,
      shippingAddress: payload.shippingAddress,
      billingAddress: payload.billingAddress,
      discountCode: payload.discountCode,
      metadata: payload.metadata,
    });

    return this.buildCheckoutResponse(session);
  }

  /**
   * Get checkout session by ID
   */
  async getCheckout(checkoutId: string): Promise<CheckoutResponse> {
    const session = await this.sessionManager.get(checkoutId);

    if (!session) {
      throw new UCPException('NOT_FOUND', `Checkout session ${checkoutId} not found`);
    }

    // Check if expired
    if (session.status === 'expired') {
      throw new UCPException('GONE', 'Checkout session has expired');
    }

    return this.buildCheckoutResponse(session);
  }

  /**
   * Update checkout session
   */
  async updateCheckout(
    checkoutId: string,
    payload: UpdateCheckoutPayload
  ): Promise<CheckoutResponse> {
    const session = await this.sessionManager.get(checkoutId);

    if (!session) {
      throw new UCPException('NOT_FOUND', `Checkout session ${checkoutId} not found`);
    }

    // Check if can be modified
    if (!canModify(session.status)) {
      throw new UCPException(
        'CONFLICT',
        `Cannot modify checkout in '${session.status}' state`
      );
    }

    // Validate discount code if provided
    let discountCode = payload.discountCode;
    if (discountCode) {
      const subtotal = session.lineItems.reduce(
        (sum, item) => sum + (item.totalPrice || 0),
        0
      );
      const discount = await validateDiscountCode(discountCode, subtotal);
      if (!discount) {
        throw new UCPException(
          'INVALID_FIELD',
          'Invalid discount code',
          {
            details: [{
              field: 'discountCode',
              code: 'INVALID_DISCOUNT',
              message: 'The discount code is invalid or expired',
            }],
          }
        );
      }
    }

    // Apply updates
    const updatedSession = await this.sessionManager.update(checkoutId, {
      buyer: payload.buyer,
      shippingAddress: payload.shippingAddress,
      billingAddress: payload.billingAddress,
      selectedFulfillmentId: payload.selectedFulfillment,
      discountCode,
    });

    if (!updatedSession) {
      throw new UCPException('CONFLICT', 'Failed to update checkout session');
    }

    logger.info(
      { checkoutId, status: updatedSession.status },
      'Updated checkout session'
    );

    return this.buildCheckoutResponse(updatedSession);
  }

  /**
   * Complete checkout with payment
   */
  async completeCheckout(
    checkoutId: string,
    payload: CompleteCheckoutPayload
  ): Promise<CompleteCheckoutResponse> {
    // Check idempotency
    const isNew = await this.sessionManager.checkIdempotency(
      checkoutId,
      payload.idempotencyKey
    );

    if (!isNew) {
      logger.warn(
        { checkoutId, idempotencyKey: payload.idempotencyKey },
        'Duplicate complete request'
      );
      // Return existing completion if available
      const session = await this.sessionManager.get(checkoutId);
      if (session?.status === 'completed' && session.orderId) {
        return {
          id: checkoutId,
          status: 'completed',
          orderId: session.orderId,
          confirmationNumber: `ORD-${session.orderId.slice(-8).toUpperCase()}`,
          totals: this.calculateSessionTotals(session),
          payment: {
            status: 'captured',
            transactionId: session.paymentTransactionId ?? 'unknown',
          },
        };
      }
      throw new UCPException('CONFLICT', 'Duplicate request with different outcome');
    }

    const session = await this.sessionManager.get(checkoutId);

    if (!session) {
      throw new UCPException('NOT_FOUND', `Checkout session ${checkoutId} not found`);
    }

    // Validate session state
    if (session.status === 'expired') {
      throw new UCPException('GONE', 'Checkout session has expired');
    }

    if (session.status === 'completed') {
      throw new UCPException('CONFLICT', 'Checkout has already been completed');
    }

    if (session.status === 'cancelled') {
      throw new UCPException('GONE', 'Checkout has been cancelled');
    }

    // Check if ready for completion
    const missingFields = getMissingFields(session);
    if (missingFields.length > 0) {
      throw new UCPException(
        'INVALID_REQUEST',
        'Checkout is missing required information',
        {
          details: missingFields.map((field) => ({
            field,
            code: 'MISSING_FIELD',
            message: `${field} is required`,
          })),
        }
      );
    }

    // Detokenize payment credential
    try {
      const detokenizeResult = await this.paymentHandler.detokenize({
        token: payload.paymentData.credential.token,
        binding: {
          checkoutId,
          businessIdentity: {
            type: 'wix_merchant_id',
            value: process.env.WIX_ACCOUNT_ID ?? 'default',
          },
        },
      });

      logger.info(
        { checkoutId, credentialType: detokenizeResult.credential.type },
        'Payment token detokenized'
      );
    } catch (error) {
      logger.error({ error, checkoutId }, 'Payment detokenization failed');
      throw new UCPException(
        'UNPROCESSABLE',
        'Payment processing failed',
        {
          details: [{
            field: 'paymentData.credential',
            code: 'PAYMENT_FAILED',
            message: 'Unable to process payment credential',
          }],
        }
      );
    }

    // Mock order creation (would integrate with Wix Orders API)
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const transactionId = `txn_${Date.now()}`;

    // Update session with payment and order info
    await this.sessionManager.setPaymentTransaction(checkoutId, transactionId);
    await this.sessionManager.complete(checkoutId, orderId);

    const totals = this.calculateSessionTotals(session);

    logger.info(
      { checkoutId, orderId, transactionId },
      'Checkout completed successfully'
    );

    return {
      id: checkoutId,
      status: 'completed',
      orderId,
      confirmationNumber: `ORD-${orderId.slice(-8).toUpperCase()}`,
      totals,
      payment: {
        status: 'captured',
        transactionId,
      },
    };
  }

  /**
   * Cancel checkout session
   */
  async cancelCheckout(checkoutId: string): Promise<void> {
    const session = await this.sessionManager.get(checkoutId);

    if (!session) {
      throw new UCPException('NOT_FOUND', `Checkout session ${checkoutId} not found`);
    }

    if (session.status === 'completed') {
      throw new UCPException('CONFLICT', 'Cannot cancel completed checkout');
    }

    const cancelled = await this.sessionManager.cancel(checkoutId);

    if (!cancelled) {
      throw new UCPException('CONFLICT', 'Failed to cancel checkout');
    }

    logger.info({ checkoutId }, 'Checkout cancelled');
  }

  /**
   * Get available fulfillment options
   * Uses WixEcommerceClient which respects DEMO_MODE for mock vs real APIs.
   */
  async getFulfillmentOptions(
    checkoutId: string,
    shippingAddress?: Address
  ): Promise<FulfillmentOption[]> {
    const session = await this.sessionManager.get(checkoutId);

    if (!session) {
      throw new UCPException('NOT_FOUND', `Checkout session ${checkoutId} not found`);
    }

    // Check if checkout has physical items
    if (!hasPhysicalItems(session.lineItems)) {
      return []; // No shipping needed for digital-only
    }

    try {
      // Use WixEcommerceClient to get shipping rates (respects DEMO_MODE)
      const client = getWixEcommerceClient();
      const response = await client.getShippingRates(checkoutId);

      return response.shippingRates.map((rate) => {
        // Parse delivery time to estimate min/max days
        const deliveryTime = rate.logistics.deliveryTime ?? '';
        let minDays = 5;
        let maxDays = 7;
        
        if (deliveryTime.includes('Next')) {
          minDays = 1;
          maxDays = 1;
        } else if (deliveryTime.includes('2-3')) {
          minDays = 2;
          maxDays = 3;
        } else if (deliveryTime.includes('5-7')) {
          minDays = 5;
          maxDays = 7;
        }

        return {
          id: `${rate.carrierId}_${rate.code}`,
          type: 'shipping' as const,
          title: rate.title,
          description: rate.logistics.deliveryTime ?? '',
          price: Math.round(parseFloat(rate.cost.price) * 100), // Convert to cents
          estimatedDelivery: { minDays, maxDays },
          carrier: rate.carrierName,
        };
      });
    } catch (error) {
      logger.warn({ error, checkoutId }, 'Failed to get shipping rates from Wix, using fallback');
      // Fallback to default options
      return [
        {
          id: 'standard_shipping',
          type: 'shipping',
          title: 'Standard Shipping',
          description: '5-7 business days',
          price: 599,
          estimatedDelivery: { minDays: 5, maxDays: 7 },
          carrier: 'USPS',
        },
        {
          id: 'express_shipping',
          type: 'shipping',
          title: 'Express Shipping',
          description: '2-3 business days',
          price: 1299,
          estimatedDelivery: { minDays: 2, maxDays: 3 },
          carrier: 'FedEx',
        },
      ];
    }
  }

  /**
   * Build full checkout response
   */
  private buildCheckoutResponse(session: StoredCheckoutSession): CheckoutResponse {
    const hasPhysical = hasPhysicalItems(session.lineItems);
    const totals = this.calculateSessionTotals(session);

    return {
      ucp: buildUCPHeader(),
      id: session.id,
      status: session.status,
      currency: session.currency,
      buyer: session.buyer,
      lineItems: session.lineItems,
      totals,
      payment: {
        handlers: [this.paymentHandler.getHandlerDeclaration()],
        selectedHandler: undefined,
        status: session.paymentTransactionId ? 'authorized' : undefined,
        transactionId: session.paymentTransactionId,
      },
      fulfillment: hasPhysical
        ? {
            options: [], // Would be populated from getFulfillmentOptions
            selectedId: session.selectedFulfillmentId,
            address: session.shippingAddress,
          }
        : undefined,
      messages: generateMessages(
        session.buyer,
        hasPhysical,
        session.selectedFulfillmentId,
        session.shippingAddress,
        !!session.discountCode
      ),
      links: generateLinks(session.id),
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  /**
   * Calculate totals for a session
   */
  private calculateSessionTotals(session: StoredCheckoutSession): Total[] {
    // Simple calculation - would use pricing engine with fulfillment options
    return recalculateTotals(session.lineItems);
  }
}

/**
 * Create checkout service instance
 */
export function createCheckoutService(
  sessionManager?: CheckoutSessionManager
): CheckoutService {
  return new CheckoutService(sessionManager);
}

/**
 * Default service instance
 */
let defaultService: CheckoutService | null = null;

/**
 * Get default checkout service
 */
export function getCheckoutService(): CheckoutService {
  if (!defaultService) {
    defaultService = createCheckoutService();
  }
  return defaultService;
}
