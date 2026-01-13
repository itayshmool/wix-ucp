/**
 * Test UI Routes
 * Serves the test console UI and provides a simplified MCP tool execution endpoint
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { logger } from '../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the public directory path
const PUBLIC_DIR = path.join(__dirname, 'public');

/**
 * MIME type mapping for static files
 */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/**
 * Serve a static file
 */
async function serveStaticFile(
  filePath: string,
  reply: FastifyReply
): Promise<FastifyReply> {
  try {
    const ext = path.extname(filePath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    const content = await fs.readFile(filePath);
    return reply.type(mimeType).send(content);
  } catch (error) {
    logger.warn({ filePath, error }, 'Static file not found');
    return reply.status(404).send({ error: 'Not found' });
  }
}

/**
 * MCP Tool Call Handler
 * Simplified endpoint for the test console to call MCP tools
 */
interface MCPCallRequest {
  tool: string;
  arguments: Record<string, unknown>;
}

interface MCPCallResponse {
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Mock tool implementations for testing
 */
const MOCK_TOOLS: Record<
  string,
  (args: Record<string, unknown>) => Promise<unknown>
> = {
  getBusinessProfile: async () => ({
    ucp: {
      version: '2026-01-11',
      services: {
        'dev.ucp.shopping': { version: '2026-01-11' },
        'dev.ucp.payment': { version: '2026-01-11' },
      },
    },
    business: {
      name: 'Mock Wix Store',
      description: 'A test store for UCP integration testing',
      logo: 'https://via.placeholder.com/150',
      supportEmail: 'support@mockstore.test',
      currency: 'USD',
      locale: 'en-US',
    },
    capabilities: [
      'dev.ucp.shopping.products',
      'dev.ucp.shopping.cart',
      'dev.ucp.shopping.checkout',
      'dev.ucp.shopping.orders',
      'dev.ucp.payment.tokenization',
      'dev.ucp.identity.linking',
    ],
    paymentHandlers: [
      {
        id: 'wix-payments',
        name: 'Wix Payments',
        supportedMethods: ['card'],
        supportedNetworks: ['visa', 'mastercard', 'amex', 'discover'],
      },
    ],
  }),

  searchProducts: async (args) => {
    const query = String(args.query || '').toLowerCase();
    const limit = Number(args.limit) || 10;

    const allProducts = [
      {
        id: 'prod_001',
        name: 'Wireless Headphones Pro',
        description: 'Premium noise-cancelling wireless headphones with 30-hour battery life',
        price: { amount: 299.99, currency: 'USD' },
        images: ['https://via.placeholder.com/400x400?text=Headphones'],
        inStock: true,
        category: 'Electronics',
      },
      {
        id: 'prod_002',
        name: 'Bluetooth Speaker',
        description: 'Portable waterproof speaker with 360° sound',
        price: { amount: 79.99, currency: 'USD' },
        images: ['https://via.placeholder.com/400x400?text=Speaker'],
        inStock: true,
        category: 'Electronics',
      },
      {
        id: 'prod_003',
        name: 'USB-C Charging Cable',
        description: 'Fast charging cable with braided nylon cover, 6ft length',
        price: { amount: 19.99, currency: 'USD' },
        images: ['https://via.placeholder.com/400x400?text=Cable'],
        inStock: true,
        category: 'Accessories',
      },
      {
        id: 'prod_004',
        name: 'Laptop Stand',
        description: 'Ergonomic aluminum laptop stand with adjustable height',
        price: { amount: 49.99, currency: 'USD' },
        images: ['https://via.placeholder.com/400x400?text=Stand'],
        inStock: true,
        category: 'Accessories',
      },
      {
        id: 'prod_005',
        name: 'Mechanical Keyboard',
        description: 'RGB mechanical keyboard with Cherry MX switches',
        price: { amount: 149.99, currency: 'USD' },
        images: ['https://via.placeholder.com/400x400?text=Keyboard'],
        inStock: false,
        category: 'Electronics',
      },
    ];

    const filtered = query
      ? allProducts.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.description.toLowerCase().includes(query) ||
            p.category.toLowerCase().includes(query)
        )
      : allProducts;

    return {
      products: filtered.slice(0, limit),
      total: filtered.length,
      query: args.query || null,
    };
  },

  getProductDetails: async (args) => {
    const productId = String(args.productId);

    const products: Record<string, unknown> = {
      prod_001: {
        id: 'prod_001',
        name: 'Wireless Headphones Pro',
        description: 'Premium noise-cancelling wireless headphones with 30-hour battery life. Features include active noise cancellation, ambient mode, and premium audio drivers.',
        price: { amount: 299.99, currency: 'USD' },
        images: [
          'https://via.placeholder.com/800x800?text=Headphones+Front',
          'https://via.placeholder.com/800x800?text=Headphones+Side',
          'https://via.placeholder.com/800x800?text=Headphones+Case',
        ],
        inStock: true,
        category: 'Electronics',
        variants: [
          { id: 'var_001', name: 'Black', sku: 'WHP-BLK', inStock: true },
          { id: 'var_002', name: 'White', sku: 'WHP-WHT', inStock: true },
          { id: 'var_003', name: 'Navy', sku: 'WHP-NVY', inStock: false },
        ],
        specifications: {
          'Battery Life': '30 hours',
          'Driver Size': '40mm',
          'Frequency Response': '20Hz - 20kHz',
          'Weight': '250g',
          'Connectivity': 'Bluetooth 5.2',
        },
      },
    };

    const product = products[productId];
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    return product;
  },

  createCart: async () => {
    const cartId = 'cart_' + Date.now().toString(36);
    return {
      id: cartId,
      lineItems: [],
      subtotal: { amount: 0, currency: 'USD' },
      createdAt: new Date().toISOString(),
    };
  },

  getCart: async (args) => {
    const cartId = String(args.cartId) || 'cart_mock';
    return {
      id: cartId,
      lineItems: [
        {
          id: 'li_001',
          productId: 'prod_001',
          name: 'Wireless Headphones Pro',
          quantity: 1,
          price: { amount: 299.99, currency: 'USD' },
          total: { amount: 299.99, currency: 'USD' },
        },
      ],
      subtotal: { amount: 299.99, currency: 'USD' },
      createdAt: new Date().toISOString(),
    };
  },

  addToCart: async (args) => {
    const cartId = String(args.cartId) || 'cart_mock';
    const productId = String(args.productId);
    const quantity = Number(args.quantity) || 1;

    return {
      id: cartId,
      lineItems: [
        {
          id: 'li_' + Date.now().toString(36),
          productId,
          name: 'Added Product',
          quantity,
          price: { amount: 99.99, currency: 'USD' },
          total: { amount: 99.99 * quantity, currency: 'USD' },
        },
      ],
      subtotal: { amount: 99.99 * quantity, currency: 'USD' },
      updatedAt: new Date().toISOString(),
    };
  },

  updateCartItem: async (args) => ({
    success: true,
    cartId: args.cartId,
    lineItemId: args.lineItemId,
    quantity: args.quantity,
    message: 'Cart item updated successfully',
  }),

  removeFromCart: async (args) => ({
    success: true,
    cartId: args.cartId,
    lineItemId: args.lineItemId,
    message: 'Item removed from cart',
  }),

  createCheckout: async (args) => {
    const checkoutId = 'chk_' + Date.now().toString(36);
    return {
      id: checkoutId,
      status: 'pending',
      buyer: args.buyer,
      lineItems: [
        {
          id: 'li_001',
          name: 'Wireless Headphones Pro',
          quantity: 1,
          price: { amount: 299.99, currency: 'USD' },
        },
      ],
      totals: [
        { type: 'SUBTOTAL', label: 'Subtotal', amount: 299.99, currency: 'USD' },
        { type: 'SHIPPING', label: 'Shipping', amount: 9.99, currency: 'USD' },
        { type: 'TAX', label: 'Tax', amount: 24.90, currency: 'USD' },
        { type: 'TOTAL', label: 'Total', amount: 334.88, currency: 'USD' },
      ],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  },

  updateCheckout: async (args) => ({
    id: args.checkoutId,
    status: 'pending',
    shippingAddress: args.shippingAddress,
    billingAddress: args.billingAddress,
    message: 'Checkout updated successfully',
    updatedAt: new Date().toISOString(),
  }),

  getShippingOptions: async (args) => ({
    checkoutId: args.checkoutId,
    options: [
      {
        id: 'ship_standard',
        name: 'Standard Shipping',
        description: '5-7 business days',
        price: { amount: 9.99, currency: 'USD' },
        estimatedDelivery: '5-7 business days',
      },
      {
        id: 'ship_express',
        name: 'Express Shipping',
        description: '2-3 business days',
        price: { amount: 19.99, currency: 'USD' },
        estimatedDelivery: '2-3 business days',
      },
      {
        id: 'ship_overnight',
        name: 'Overnight Shipping',
        description: 'Next business day',
        price: { amount: 34.99, currency: 'USD' },
        estimatedDelivery: 'Next business day',
      },
    ],
  }),

  completeCheckout: async (args) => {
    const orderId = 'ord_' + Date.now().toString(36);
    return {
      success: true,
      orderId,
      checkoutId: args.checkoutId,
      status: 'confirmed',
      confirmationNumber: `WIX-${Date.now().toString(36).toUpperCase()}`,
      message: 'Order placed successfully!',
      createdAt: new Date().toISOString(),
    };
  },

  getOrder: async (args) => {
    const orderId = String(args.orderId) || 'order_001';
    return {
      id: orderId,
      confirmationNumber: 'WIX-ABC123',
      status: 'shipped',
      buyer: {
        email: 'customer@example.com',
        firstName: 'John',
        lastName: 'Doe',
      },
      lineItems: [
        {
          id: 'li_001',
          name: 'Wireless Headphones Pro',
          quantity: 1,
          price: { amount: 299.99, currency: 'USD' },
        },
      ],
      totals: [
        { type: 'SUBTOTAL', amount: 299.99, currency: 'USD' },
        { type: 'SHIPPING', amount: 9.99, currency: 'USD' },
        { type: 'TAX', amount: 24.90, currency: 'USD' },
        { type: 'TOTAL', amount: 334.88, currency: 'USD' },
      ],
      fulfillment: {
        status: 'shipped',
        trackingNumber: '1Z999AA10123456784',
        carrier: 'UPS',
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  listOrders: async (args) => ({
    orders: [
      {
        id: 'ord_001',
        confirmationNumber: 'WIX-ABC123',
        status: 'shipped',
        total: { amount: 334.88, currency: 'USD' },
        itemCount: 1,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'ord_002',
        confirmationNumber: 'WIX-DEF456',
        status: 'delivered',
        total: { amount: 79.99, currency: 'USD' },
        itemCount: 1,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    pagination: {
      total: 2,
      limit: args.limit || 10,
      hasMore: false,
    },
  }),

  linkIdentity: async (args) => ({
    authorizationUrl: `${args.redirectUri}?mock=true&state=test123`,
    state: 'test123',
    message: 'In production, this would redirect to the OAuth provider',
  }),
};

/**
 * Execute an MCP tool
 */
async function executeMCPTool(
  tool: string,
  args: Record<string, unknown>
): Promise<MCPCallResponse> {
  const handler = MOCK_TOOLS[tool];

  if (!handler) {
    return {
      success: false,
      error: `Unknown tool: ${tool}. Available tools: ${Object.keys(MOCK_TOOLS).join(', ')}`,
    };
  }

  try {
    const result = await handler(args);
    return { success: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Register test UI routes
 */
export function testUIRoutes(
  fastify: FastifyInstance,
  _opts: unknown,
  done: () => void
): void {
  // Redirect /test-ui to /test-ui/console
  fastify.get('/test-ui', async (_request, reply) => {
    return reply.redirect('/test-ui/console');
  });

  // Serve console index.html
  fastify.get('/test-ui/console', async (_request, reply) => {
    const filePath = path.join(PUBLIC_DIR, 'console', 'index.html');
    return serveStaticFile(filePath, reply);
  });

  // Serve console static files
  fastify.get('/test-ui/console/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const filePath = path.join(PUBLIC_DIR, 'console', filename);
    return serveStaticFile(filePath, reply);
  });

  // Serve wizard index.html
  fastify.get('/test-ui/wizard', async (_request, reply) => {
    const filePath = path.join(PUBLIC_DIR, 'wizard', 'index.html');
    return serveStaticFile(filePath, reply);
  });

  // Serve wizard static files
  fastify.get('/test-ui/wizard/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const filePath = path.join(PUBLIC_DIR, 'wizard', filename);
    return serveStaticFile(filePath, reply);
  });

  // MCP tool call endpoint (for test UI)
  fastify.post<{
    Body: MCPCallRequest;
  }>('/test-ui/api/call', async (request, reply) => {
    const { tool, arguments: args } = request.body;

    logger.info({ tool, args }, 'MCP tool call received');

    if (!tool) {
      return reply.status(400).send({
        success: false,
        error: 'Missing required field: tool',
      });
    }

    const result = await executeMCPTool(tool, args || {});

    if (result.success) {
      return reply.status(200).send(result);
    } else {
      return reply.status(400).send(result);
    }
  });

  // Session endpoint (for test UI)
  fastify.post('/test-ui/api/session', async (_request, reply) => {
    const sessionId = 'mcp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    return reply.status(200).send({ sessionId });
  });

  // List available tools (for test UI)
  fastify.get('/test-ui/api/tools', async (_request, reply) => {
    const tools = Object.keys(MOCK_TOOLS).map((name) => ({
      name,
      description: `Mock implementation of ${name}`,
    }));

    return reply.status(200).send({ tools });
  });

  done();
}

export default testUIRoutes;
