/**
 * MCP Bridge Types
 * 
 * Type definitions for MCP-UCP bridge.
 * See: .cursor/rules/modules/mcp-bridge.mdc
 */

import type { CheckoutService } from '../checkout/service.js';
import type { OrderService } from '../orders/service.js';

// ─────────────────────────────────────────────────────────────
// MCP Session Types
// ─────────────────────────────────────────────────────────────

/**
 * MCP session
 */
export interface MCPSession {
  /** Session ID */
  id: string;
  /** Visitor token for Wix API */
  visitorToken?: string;
  /** Member token for authenticated users */
  memberToken?: string;
  /** Current checkout ID */
  checkoutId?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Expiration timestamp */
  expiresAt: Date;
}

/**
 * Stored session in Redis
 */
export interface StoredSession {
  id: string;
  visitorToken?: string;
  memberToken?: string;
  checkoutId?: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Member credentials for authentication
 */
export interface MemberCredentials {
  email: string;
  accessToken: string;
}

// ─────────────────────────────────────────────────────────────
// MCP Context Types
// ─────────────────────────────────────────────────────────────

/**
 * Service names available in context
 */
export type ServiceName = 'checkout' | 'catalog' | 'orders' | 'identity' | 'payments';

/**
 * MCP context passed to handlers
 */
export interface MCPContext {
  /** Current session */
  session: MCPSession;
  /** Site ID */
  siteId: string;
  /** User locale */
  locale?: string;
  /** Currency */
  currency?: string;
  /** Force demo or live mode (overrides DEMO_MODE env var) */
  forceMode?: 'demo' | 'live';
}

// ─────────────────────────────────────────────────────────────
// MCP Tool Types
// ─────────────────────────────────────────────────────────────

/**
 * JSON Schema for tool input
 */
export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    default?: unknown;
    enum?: string[];
    items?: {
      type: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };
    properties?: Record<string, {
      type: string;
      description?: string;
    }>;
  }>;
  required?: string[];
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Input schema */
  inputSchema: ToolInputSchema;
}

/**
 * MCP Tool result
 */
export interface MCPToolResult {
  /** Result content */
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  /** Whether result is an error */
  isError?: boolean;
}

/**
 * MCP Tool handler function
 */
export type ToolHandler = (
  args: Record<string, unknown>,
  context: MCPContext
) => Promise<MCPToolResult>;

// ─────────────────────────────────────────────────────────────
// MCP Server Types
// ─────────────────────────────────────────────────────────────

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  /** Server name */
  name: string;
  /** Server version */
  version: string;
  /** Site ID */
  siteId: string;
  /** Session TTL in seconds */
  sessionTTL?: number;
}

/**
 * MCP Call request
 */
export interface MCPCallRequest {
  /** Session ID */
  sessionId?: string;
  /** Tool name */
  tool: string;
  /** Tool arguments */
  arguments: Record<string, unknown>;
}

/**
 * MCP Call response
 */
export interface MCPCallResponse {
  /** Session ID */
  sessionId: string;
  /** Result */
  result: MCPToolResult;
}

// ─────────────────────────────────────────────────────────────
// Tool Argument Types
// ─────────────────────────────────────────────────────────────

/**
 * Create checkout arguments
 */
export interface CreateCheckoutArgs {
  lineItems: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
  }>;
  currency?: string;
  buyerEmail?: string;
}

/**
 * Update checkout arguments
 */
export interface UpdateCheckoutArgs {
  checkoutId: string;
  buyerEmail?: string;
  buyerName?: string;
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  selectedFulfillmentId?: string;
  discountCode?: string;
}

/**
 * Complete checkout arguments
 */
export interface CompleteCheckoutArgs {
  checkoutId: string;
  paymentToken: string;
  handlerId: string;
}

/**
 * Search products arguments
 */
export interface SearchProductsArgs {
  query?: string;
  limit?: number;
  offset?: number;
  filters?: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
  };
}

/**
 * Get product arguments
 */
export interface GetProductArgs {
  productId: string;
}

/**
 * Get order arguments
 */
export interface GetOrderArgs {
  orderId: string;
}

/**
 * List orders arguments
 */
export interface ListOrdersArgs {
  limit?: number;
  status?: 'pending' | 'shipped' | 'delivered' | 'cancelled';
}

/**
 * Link identity arguments
 */
export interface LinkIdentityArgs {
  email: string;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export const MCP_SERVER_INFO = {
  name: 'wix-ucp-mcp',
  version: '1.0.0',
} as const;

export const SESSION_TTL = 24 * 60 * 60; // 24 hours

export const WIX_STORES_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e';
