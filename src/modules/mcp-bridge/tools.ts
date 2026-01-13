/**
 * MCP Tool Definitions
 * 
 * Defines all available MCP tools for the Wix UCP integration.
 * See: .cursor/rules/modules/mcp-bridge.mdc
 */

import type { MCPTool } from './types.js';

/**
 * All available MCP tools
 */
export const UCP_MCP_TOOLS: MCPTool[] = [
  // ─────────────────────────────────────────────────────────────
  // Profile & Discovery
  // ─────────────────────────────────────────────────────────────

  {
    name: 'getBusinessProfile',
    description: 'Get the UCP business profile including capabilities and payment handlers',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Catalog
  // ─────────────────────────────────────────────────────────────

  {
    name: 'searchProducts',
    description: 'Search products in the catalog',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default 10)' },
        offset: { type: 'number', description: 'Pagination offset (default 0)' },
        filters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Filter by category' },
            minPrice: { type: 'number', description: 'Minimum price' },
            maxPrice: { type: 'number', description: 'Maximum price' },
            inStock: { type: 'boolean', description: 'Only in-stock items' },
          },
        },
      },
      required: [],
    },
  },

  {
    name: 'getProduct',
    description: 'Get detailed product information',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'Product ID' },
      },
      required: ['productId'],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Checkout
  // ─────────────────────────────────────────────────────────────

  {
    name: 'createCheckout',
    description: 'Create a new checkout session with items',
    inputSchema: {
      type: 'object',
      properties: {
        lineItems: {
          type: 'array',
          description: 'Items to add to checkout',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              variantId: { type: 'string' },
              quantity: { type: 'number' },
            },
            required: ['productId', 'quantity'],
          },
        },
        currency: { type: 'string', description: 'Currency code (default USD)' },
        buyerEmail: { type: 'string', description: 'Buyer email address' },
      },
      required: ['lineItems'],
    },
  },

  {
    name: 'getCheckout',
    description: 'Get checkout session details',
    inputSchema: {
      type: 'object',
      properties: {
        checkoutId: { type: 'string', description: 'Checkout ID' },
      },
      required: ['checkoutId'],
    },
  },

  {
    name: 'updateCheckout',
    description: 'Update checkout with buyer info or shipping',
    inputSchema: {
      type: 'object',
      properties: {
        checkoutId: { type: 'string', description: 'Checkout ID' },
        buyerEmail: { type: 'string', description: 'Buyer email' },
        buyerName: { type: 'string', description: 'Buyer full name' },
        shippingAddress: {
          type: 'object',
          description: 'Shipping address',
          properties: {
            line1: { type: 'string' },
            line2: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            postalCode: { type: 'string' },
            country: { type: 'string' },
          },
        },
        selectedFulfillmentId: { type: 'string', description: 'Selected shipping option ID' },
        discountCode: { type: 'string', description: 'Discount/coupon code' },
      },
      required: ['checkoutId'],
    },
  },

  {
    name: 'getPaymentHandlers',
    description: 'Get available payment handlers for checkout',
    inputSchema: {
      type: 'object',
      properties: {
        checkoutId: { type: 'string', description: 'Checkout ID' },
      },
      required: ['checkoutId'],
    },
  },

  {
    name: 'completeCheckout',
    description: 'Complete checkout with payment token',
    inputSchema: {
      type: 'object',
      properties: {
        checkoutId: { type: 'string', description: 'Checkout ID' },
        paymentToken: { type: 'string', description: 'Payment token from handler' },
        handlerId: { type: 'string', description: 'Payment handler ID' },
      },
      required: ['checkoutId', 'paymentToken', 'handlerId'],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Orders
  // ─────────────────────────────────────────────────────────────

  {
    name: 'getOrder',
    description: 'Get order details by ID',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'Order ID' },
      },
      required: ['orderId'],
    },
  },

  {
    name: 'listOrders',
    description: 'List orders for the current visitor',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 10)' },
        status: { 
          type: 'string',
          description: 'Filter by status',
          enum: ['pending', 'shipped', 'delivered', 'cancelled'],
        },
      },
      required: [],
    },
  },

  {
    name: 'getOrderTracking',
    description: 'Get shipment tracking for an order',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'Order ID' },
      },
      required: ['orderId'],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Identity
  // ─────────────────────────────────────────────────────────────

  {
    name: 'createVisitorSession',
    description: 'Create a visitor session and get access token',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  {
    name: 'linkIdentity',
    description: 'Link visitor to existing member account',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Member email address' },
      },
      required: ['email'],
    },
  },

  {
    name: 'getMemberInfo',
    description: 'Get current member information',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Embedded Checkout
  // ─────────────────────────────────────────────────────────────

  {
    name: 'getEmbeddedCheckoutUrl',
    description: 'Get URL for embedded checkout experience',
    inputSchema: {
      type: 'object',
      properties: {
        checkoutId: { type: 'string', description: 'Checkout ID' },
      },
      required: ['checkoutId'],
    },
  },
];

/**
 * Get tool by name
 */
export function getTool(name: string): MCPTool | undefined {
  return UCP_MCP_TOOLS.find(t => t.name === name);
}

/**
 * Get all tool names
 */
export function getToolNames(): string[] {
  return UCP_MCP_TOOLS.map(t => t.name);
}

/**
 * Validate tool arguments against schema
 */
export function validateToolArgs(
  tool: MCPTool,
  args: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const schema = tool.inputSchema;

  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (args[field] === undefined || args[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  // Check property types (basic validation)
  for (const [key, value] of Object.entries(args)) {
    const propSchema = schema.properties[key];
    if (propSchema) {
      const expectedType = propSchema.type;
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      
      if (expectedType !== actualType) {
        errors.push(`Field '${key}' expected ${expectedType}, got ${actualType}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
