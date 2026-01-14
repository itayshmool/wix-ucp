/**
 * Catalog Tool Handlers
 * 
 * MCP handlers for catalog/product operations.
 * Uses WixEcommerceClient which respects DEMO_MODE for mock vs real APIs.
 */

import type { MCPToolResult, ToolHandler } from '../types.js';
import { getWixEcommerceClient } from '../../../adapters/wix/ecommerce.js';
import type { WixProduct } from '../../../adapters/wix/types.js';

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function formatPrice(priceData: WixProduct['priceData']): string {
  if (priceData.discountedPrice !== undefined) {
    return `${priceData.formatted.discountedPrice} (was ${priceData.formatted.price})`;
  }
  return priceData.formatted.price;
}

function formatPriceRaw(priceData: WixProduct['priceData']): {
  amount: number;
  currency: string;
  discountedAmount?: number;
} {
  const result: { amount: number; currency: string; discountedAmount?: number } = {
    amount: Math.round(priceData.price * 100), // Convert to cents
    currency: priceData.currency,
  };
  if (priceData.discountedPrice !== undefined) {
    result.discountedAmount = Math.round(priceData.discountedPrice * 100);
  }
  return result;
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

const searchProducts: ToolHandler = async (args) => {
  const query = (args.query as string | undefined) ?? '';
  const limit = (args.limit as number | undefined) ?? 10;
  const offset = (args.offset as number | undefined) ?? 0;

  try {
    const client = getWixEcommerceClient();
    const response = await client.searchProducts(query, { limit, offset });

    const products = response.products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description?.substring(0, 200),
      price: formatPrice(p.priceData),
      imageUrl: p.media.mainMedia?.url,
      inStock: p.stock.inStock,
      type: p.productType,
      brand: p.brand,
      sku: p.sku,
      optionCount: p.productOptions.length,
    }));

    return createTextResult({
      products,
      total: response.metadata.total,
      offset: response.metadata.offset,
      limit,
      hasMore: response.metadata.offset + products.length < response.metadata.total,
      mode: client.isInMockMode() ? 'demo' : 'live',
      message:
        response.metadata.total > 0
          ? `Found ${response.metadata.total} product(s)${query ? ` matching "${query}"` : ''}`
          : 'No products found matching your criteria',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResult(`Failed to search products: ${message}`);
  }
};

const getProduct: ToolHandler = async (args) => {
  const productId = args.productId as string | undefined;

  if (!productId) {
    return createErrorResult('productId is required');
  }

  try {
    const client = getWixEcommerceClient();
    const product = await client.getProduct(productId);

    return createTextResult({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      type: product.productType,
      price: formatPrice(product.priceData),
      priceRaw: formatPriceRaw(product.priceData),
      inStock: product.stock.inStock,
      stockQuantity: product.stock.quantity,
      trackInventory: product.stock.trackInventory,
      imageUrl: product.media.mainMedia?.url,
      images: product.media.items.map((m) => m.url),
      sku: product.sku,
      brand: product.brand,
      weight: product.weight,
      options:
        product.productOptions.length > 0
          ? product.productOptions.map((o) => ({
              name: o.name,
              type: o.optionType,
              choices: o.choices.map((c) => ({
                value: c.value,
                inStock: c.inStock,
              })),
            }))
          : undefined,
      mode: client.isInMockMode() ? 'demo' : 'live',
      message: product.stock.inStock
        ? 'Product is in stock and available for purchase'
        : 'Product is currently out of stock',
      actions: product.stock.inStock
        ? ['Add to checkout with createCheckout']
        : ['Product unavailable - try searching for alternatives'],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('NOT_FOUND') || message.includes('not found')) {
      return createErrorResult(`Product ${productId} not found`);
    }
    return createErrorResult(`Failed to get product: ${message}`);
  }
};

const getBusinessProfile: ToolHandler = async () => {
  const client = getWixEcommerceClient();
  const isDemo = client.isInMockMode();

  return createTextResult({
    business: {
      name: isDemo ? 'Demo Store (DEMO MODE)' : 'Wix Store (Live)',
      description: isDemo
        ? 'A demonstration store running in DEMO mode with mock data'
        : 'A live Wix store powered by UCP',
      currency: 'USD',
      locale: 'en-US',
    },
    mode: isDemo ? 'demo' : 'live',
    capabilities: [
      {
        name: 'dev.ucp.shopping.checkout',
        version: '2026-01-11',
        description: 'Full checkout flow support',
      },
      {
        name: 'dev.ucp.shopping.orders',
        version: '2026-01-11',
        description: 'Order management and tracking',
      },
      {
        name: 'dev.ucp.shopping.identity',
        version: '2026-01-11',
        description: 'OAuth 2.0 identity linking',
      },
    ],
    paymentHandlers: [
      {
        id: 'com.wix.payments',
        name: 'Wix Payments',
        supportedNetworks: ['visa', 'mastercard', 'amex', 'discover'],
      },
    ],
    policies: {
      returnWindow: 30,
      shipping: 'Standard and express options available',
    },
    message: isDemo
      ? 'Running in DEMO mode - using mock data. Set DEMO_MODE=false with Wix credentials for live data.'
      : 'Running in LIVE mode - connected to real Wix store',
    availableTools: [
      'searchProducts - Search for products',
      'getProduct - Get product details',
      'createCheckout - Create a checkout session',
      'getCheckout - View checkout status',
      'updateCheckout - Add buyer/shipping info',
      'completeCheckout - Complete purchase',
      'getOrder - View order details',
      'listOrders - View order history',
    ],
  });
};

// ─────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────

export const catalogHandlers: Record<string, ToolHandler> = {
  searchProducts,
  getProduct,
  getBusinessProfile,
};
