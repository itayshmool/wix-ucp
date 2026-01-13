/**
 * Checkout Tool Handlers
 * 
 * MCP handlers for checkout operations.
 */

import { createCheckoutService } from '../../checkout/service.js';
import { env } from '../../../config/env.js';
import type { MCPContext, MCPToolResult, ToolHandler } from '../types.js';
import { WIX_STORES_APP_ID } from '../types.js';

const UCP_BASE_URL = env.UCP_BASE_URL ?? 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount / 100);
}

function createTextResult(data: unknown): MCPToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function createErrorResult(message: string): MCPToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: true, message }),
      },
    ],
    isError: true,
  };
}

// ─────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────

const createCheckout: ToolHandler = async (args, context) => {
  const lineItems = args.lineItems as Array<{ productId: string; variantId?: string; quantity: number }> | undefined;
  const currency = (args.currency as string) ?? 'USD';
  const buyerEmail = args.buyerEmail as string | undefined;

  if (!lineItems || lineItems.length === 0) {
    return createErrorResult('At least one line item is required');
  }

  const checkoutService = createCheckoutService();

  try {
    const checkout = await checkoutService.createCheckout({
      currency,
      buyer: buyerEmail ? { email: buyerEmail } : undefined,
      lineItems: lineItems.map(item => ({
        catalogReference: {
          catalogItemId: item.productId,
          appId: WIX_STORES_APP_ID,
          options: item.variantId ? { variantId: item.variantId } : undefined,
        },
        quantity: item.quantity,
      })),
    });

    const total = checkout.totals.find(t => t.type === 'TOTAL');

    return createTextResult({
      checkoutId: checkout.id,
      status: checkout.status,
      total: total ? formatPrice(total.amount, checkout.currency) : undefined,
      currency: checkout.currency,
      itemCount: checkout.lineItems.length,
      message: `Checkout created successfully. ${getStatusMessage(checkout.status)}`,
      nextSteps: getNextSteps(checkout.status),
    });
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error.message : 'Failed to create checkout'
    );
  }
};

const getCheckout: ToolHandler = async (args, context) => {
  const checkoutId = args.checkoutId as string | undefined;

  if (!checkoutId) {
    return createErrorResult('checkoutId is required');
  }

  const checkoutService = createCheckoutService();

  try {
    const checkout = await checkoutService.getCheckout(checkoutId);
    const total = checkout.totals.find(t => t.type === 'TOTAL');

    return createTextResult({
      checkoutId: checkout.id,
      status: checkout.status,
      total: total ? formatPrice(total.amount, checkout.currency) : undefined,
      currency: checkout.currency,
      items: checkout.lineItems.map(li => ({
        id: li.id,
        name: li.item.title,
        quantity: li.quantity,
        price: formatPrice(li.item.price * li.quantity, checkout.currency),
      })),
      buyer: checkout.buyer,
      messages: checkout.messages,
      statusMessage: getStatusMessage(checkout.status),
      nextSteps: getNextSteps(checkout.status),
    });
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error.message : 'Checkout not found'
    );
  }
};

const updateCheckout: ToolHandler = async (args, context) => {
  const checkoutId = args.checkoutId as string | undefined;
  const buyerEmail = args.buyerEmail as string | undefined;
  const buyerName = args.buyerName as string | undefined;
  const shippingAddress = args.shippingAddress as {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  } | undefined;
  const selectedFulfillmentId = args.selectedFulfillmentId as string | undefined;

  if (!checkoutId) {
    return createErrorResult('checkoutId is required');
  }

  const checkoutService = createCheckoutService();

  try {
    // Parse name if provided
    let buyer;
    if (buyerEmail || buyerName) {
      const nameParts = buyerName?.split(' ') ?? [];
      buyer = {
        email: buyerEmail,
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(' ') || undefined,
      };
    }

    const checkout = await checkoutService.updateCheckout(checkoutId, {
      buyer,
      shippingAddress: shippingAddress ? {
        line1: shippingAddress.line1,
        line2: shippingAddress.line2,
        city: shippingAddress.city,
        state: shippingAddress.state,
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country,
      } : undefined,
      selectedFulfillment: selectedFulfillmentId,
    });

    const total = checkout.totals.find(t => t.type === 'TOTAL');

    return createTextResult({
      checkoutId: checkout.id,
      status: checkout.status,
      total: total ? formatPrice(total.amount, checkout.currency) : undefined,
      message: 'Checkout updated successfully',
      statusMessage: getStatusMessage(checkout.status),
      nextSteps: getNextSteps(checkout.status),
    });
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error.message : 'Failed to update checkout'
    );
  }
};

const getPaymentHandlers: ToolHandler = async (args, context) => {
  const checkoutId = args.checkoutId as string | undefined;

  // Return mock payment handlers
  return createTextResult({
    checkoutId,
    handlers: [
      {
        id: 'com.wix.payments',
        name: 'Wix Payments',
        type: 'CARD',
        supportedNetworks: ['visa', 'mastercard', 'amex', 'discover'],
        tokenizeUrl: `${UCP_BASE_URL}/payment-handler/tokenize`,
      },
    ],
    message: 'Payment handlers available. Use tokenize endpoint with card details to get payment token.',
  });
};

const completeCheckout: ToolHandler = async (args, context) => {
  const checkoutId = args.checkoutId as string | undefined;
  const paymentToken = args.paymentToken as string | undefined;
  const handlerId = args.handlerId as string | undefined;

  if (!checkoutId || !paymentToken || !handlerId) {
    return createErrorResult('checkoutId, paymentToken, and handlerId are required');
  }

  const checkoutService = createCheckoutService();

  try {
    const result = await checkoutService.completeCheckout(checkoutId, {
      paymentData: {
        id: `payment_${Date.now()}`,
        handlerId,
        credential: {
          type: 'token',
          token: paymentToken,
        },
      },
      idempotencyKey: `idem_${checkoutId}_${Date.now()}`,
    });

    return createTextResult({
      success: true,
      orderId: result.orderId,
      confirmationNumber: result.confirmationNumber,
      status: 'completed',
      message: `Order completed successfully! Confirmation number: ${result.confirmationNumber}`,
      orderUrl: `${UCP_BASE_URL}/ucp/v1/orders/${result.orderId}`,
    });
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error.message : 'Failed to complete checkout'
    );
  }
};

const getEmbeddedCheckoutUrl: ToolHandler = async (args, context) => {
  const { checkoutId } = args as { checkoutId: string };

  if (!checkoutId) {
    return createErrorResult('checkoutId is required');
  }

  // Return mock embedded checkout URL
  return createTextResult({
    checkoutId,
    embeddedUrl: `${UCP_BASE_URL}/checkout/embed/${checkoutId}`,
    expiresIn: 3600,
    message: 'Use this URL to embed checkout in your interface',
  });
};

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function getStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    created: 'Checkout created. Add buyer information and shipping address.',
    incomplete: 'Missing required information. Check messages for details.',
    ready_for_payment: 'Ready to complete. Provide payment token.',
    processing: 'Processing payment...',
    completed: 'Order completed successfully!',
    abandoned: 'Checkout was abandoned.',
    expired: 'Checkout has expired. Please create a new one.',
  };

  return messages[status] ?? `Status: ${status}`;
}

function getNextSteps(status: string): string[] {
  const steps: Record<string, string[]> = {
    created: [
      'Add buyer email with updateCheckout',
      'Add shipping address with updateCheckout',
      'Get payment handlers with getPaymentHandlers',
    ],
    incomplete: [
      'Check messages for missing information',
      'Update checkout with required fields',
    ],
    ready_for_payment: [
      'Get payment handlers with getPaymentHandlers',
      'Complete checkout with completeCheckout',
    ],
    completed: [
      'Get order details with getOrder',
      'Track shipment with getOrderTracking',
    ],
  };

  return steps[status] ?? [];
}

// ─────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────

export const checkoutHandlers: Record<string, ToolHandler> = {
  createCheckout,
  getCheckout,
  updateCheckout,
  getPaymentHandlers,
  completeCheckout,
  getEmbeddedCheckoutUrl,
};
