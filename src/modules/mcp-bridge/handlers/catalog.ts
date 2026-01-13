/**
 * Catalog Tool Handlers
 * 
 * MCP handlers for catalog/product operations.
 */

import type { MCPContext, MCPToolResult, ToolHandler } from '../types.js';

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
// Mock Product Data
// ─────────────────────────────────────────────────────────────

const MOCK_PRODUCTS = [
  {
    id: 'prod_001',
    name: 'Premium Wireless Headphones',
    description: 'High-quality wireless headphones with noise cancellation',
    price: 14999,
    currency: 'USD',
    category: 'Electronics',
    inStock: true,
    stockQuantity: 50,
    imageUrl: 'https://example.com/headphones.jpg',
    variants: [],
  },
  {
    id: 'prod_002',
    name: 'Organic Cotton T-Shirt',
    description: 'Soft, sustainable organic cotton t-shirt',
    price: 2999,
    currency: 'USD',
    category: 'Apparel',
    inStock: true,
    stockQuantity: 100,
    imageUrl: 'https://example.com/tshirt.jpg',
    variants: [
      { id: 'var_s', name: 'Small' },
      { id: 'var_m', name: 'Medium' },
      { id: 'var_l', name: 'Large' },
    ],
  },
  {
    id: 'prod_003',
    name: 'Stainless Steel Water Bottle',
    description: 'Eco-friendly 32oz insulated water bottle',
    price: 2499,
    currency: 'USD',
    category: 'Home & Kitchen',
    inStock: true,
    stockQuantity: 75,
    imageUrl: 'https://example.com/bottle.jpg',
    variants: [],
  },
  {
    id: 'prod_004',
    name: 'Yoga Mat Pro',
    description: 'Non-slip professional yoga mat with carrying strap',
    price: 4999,
    currency: 'USD',
    category: 'Sports',
    inStock: false,
    stockQuantity: 0,
    imageUrl: 'https://example.com/yogamat.jpg',
    variants: [],
  },
  {
    id: 'prod_005',
    name: 'Leather Wallet',
    description: 'Genuine leather bifold wallet with RFID protection',
    price: 5999,
    currency: 'USD',
    category: 'Accessories',
    inStock: true,
    stockQuantity: 30,
    imageUrl: 'https://example.com/wallet.jpg',
    variants: [
      { id: 'var_black', name: 'Black' },
      { id: 'var_brown', name: 'Brown' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────

const searchProducts: ToolHandler = async (args, context) => {
  const query = args.query as string | undefined;
  const limit = (args.limit as number | undefined) ?? 10;
  const offset = (args.offset as number | undefined) ?? 0;
  const filters = args.filters as {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
  } | undefined;

  let results = [...MOCK_PRODUCTS];

  // Apply text search
  if (query) {
    const queryLower = query.toLowerCase();
    results = results.filter(
      p =>
        p.name.toLowerCase().includes(queryLower) ||
        p.description.toLowerCase().includes(queryLower) ||
        p.category.toLowerCase().includes(queryLower)
    );
  }

  // Apply filters
  if (filters) {
    if (filters.category) {
      results = results.filter(
        p => p.category.toLowerCase() === filters.category?.toLowerCase()
      );
    }
    if (filters.minPrice !== undefined) {
      results = results.filter(p => p.price >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined) {
      results = results.filter(p => p.price <= filters.maxPrice!);
    }
    if (filters.inStock !== undefined) {
      results = results.filter(p => p.inStock === filters.inStock);
    }
  }

  // Apply pagination
  const total = results.length;
  results = results.slice(offset, offset + limit);

  return createTextResult({
    products: results.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description.substring(0, 200),
      price: formatPrice(p.price, p.currency),
      imageUrl: p.imageUrl,
      inStock: p.inStock,
      category: p.category,
      variantCount: p.variants.length,
    })),
    total,
    offset,
    limit,
    hasMore: offset + results.length < total,
    message: total > 0
      ? `Found ${total} product(s)${query ? ` matching "${query}"` : ''}`
      : 'No products found matching your criteria',
  });
};

const getProduct: ToolHandler = async (args, context) => {
  const productId = args.productId as string | undefined;

  if (!productId) {
    return createErrorResult('productId is required');
  }

  const product = MOCK_PRODUCTS.find(p => p.id === productId);

  if (!product) {
    return createErrorResult(`Product ${productId} not found`);
  }

  return createTextResult({
    id: product.id,
    name: product.name,
    description: product.description,
    price: formatPrice(product.price, product.currency),
    priceRaw: {
      amount: product.price,
      currency: product.currency,
    },
    category: product.category,
    inStock: product.inStock,
    stockQuantity: product.stockQuantity,
    imageUrl: product.imageUrl,
    variants: product.variants.length > 0
      ? product.variants.map(v => ({
          id: v.id,
          name: v.name,
        }))
      : undefined,
    message: product.inStock
      ? 'Product is in stock and available for purchase'
      : 'Product is currently out of stock',
    actions: product.inStock
      ? ['Add to checkout with createCheckout']
      : ['Product unavailable - try searching for alternatives'],
  });
};

const getBusinessProfile: ToolHandler = async (args, context) => {
  // Return mock business profile
  return createTextResult({
    business: {
      name: 'Demo Store',
      description: 'A demonstration Wix store powered by UCP',
      logo: 'https://example.com/logo.png',
      currency: 'USD',
      locale: 'en-US',
    },
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
    message: 'Welcome! This store supports full checkout, order management, and identity linking.',
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
