/**
 * Discovery Profile Types
 * 
 * Type definitions for UCP business profile discovery.
 * See: .cursor/rules/modules/discovery.mdc
 */

import type { Address } from '../../core/types/ucp-common.js';
import type { PaymentHandler } from '../../core/types/payment.js';

// ─────────────────────────────────────────────────────────────
// Service Definition
// ─────────────────────────────────────────────────────────────

/**
 * Transport endpoint configuration
 */
export interface TransportEndpoint {
  /** OpenAPI/OpenRPC schema URL */
  schema?: string;
  /** Endpoint URL */
  endpoint: string;
}

/**
 * Service definition in UCP profile
 */
export interface ServiceDefinition {
  /** Service version */
  version: string;
  /** Specification URL */
  spec: string;
  /** REST API transport */
  rest?: TransportEndpoint;
  /** MCP transport */
  mcp?: TransportEndpoint;
  /** Agent-to-Agent transport */
  a2a?: { endpoint: string };
  /** Embedded transport (schema only) */
  embedded?: { schema: string };
}

// ─────────────────────────────────────────────────────────────
// Business Info
// ─────────────────────────────────────────────────────────────

/**
 * Business contact information
 */
export interface BusinessContact {
  /** Contact email */
  email?: string;
  /** Contact phone */
  phone?: string;
}

/**
 * Business information
 */
export interface BusinessInfo {
  /** Unique business ID (site ID) */
  id: string;
  /** Business name */
  name: string;
  /** Business description */
  description?: string;
  /** Logo URL */
  logo?: string;
  /** Business website URL */
  url?: string;
  /** Contact information */
  contact?: BusinessContact;
  /** Physical address */
  address?: Address;
  /** Timezone (IANA format) */
  timezone?: string;
  /** Primary currency (ISO 4217) */
  currency: string;
  /** Supported currencies */
  supportedCurrencies?: string[];
}

// ─────────────────────────────────────────────────────────────
// Capabilities
// ─────────────────────────────────────────────────────────────

/**
 * UCP capability declaration
 */
export interface Capability {
  /** Capability name (e.g., "dev.ucp.shopping.checkout") */
  name: string;
  /** Capability version */
  version: string;
  /** Specification URL */
  spec: string;
  /** JSON Schema URL */
  schema?: string;
}

/**
 * Capability handler interface (for internal use)
 */
export interface CapabilityHandler {
  /** Handle capability request */
  handle(request: unknown): Promise<unknown>;
}

/**
 * Full capability definition with handler
 */
export interface CapabilityDefinition extends Capability {
  /** Implementation handler */
  handler?: CapabilityHandler;
  /** Supported extensions */
  extensions?: string[];
}

// ─────────────────────────────────────────────────────────────
// Extensions
// ─────────────────────────────────────────────────────────────

/**
 * UCP extension declaration
 */
export interface Extension {
  /** Extension name */
  name: string;
  /** Extension version */
  version: string;
  /** Specification URL */
  spec: string;
  /** Capability this extension extends */
  extends?: string;
}

// ─────────────────────────────────────────────────────────────
// Payment Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Payment configuration in profile
 */
export interface PaymentConfig {
  /** Available payment handlers */
  handlers: PaymentHandler[];
}

// ─────────────────────────────────────────────────────────────
// UCP Profile
// ─────────────────────────────────────────────────────────────

/**
 * UCP services map
 */
export interface UCPServices {
  'dev.ucp.shopping'?: ServiceDefinition;
  [key: string]: ServiceDefinition | undefined;
}

/**
 * UCP version info in profile
 */
export interface UCPInfo {
  /** Protocol version */
  version: string;
  /** Service definitions */
  services: UCPServices;
}

/**
 * Complete UCP business profile
 */
export interface UCPProfile {
  /** UCP protocol info */
  ucp: UCPInfo;
  /** Business information */
  business: BusinessInfo;
  /** Supported capabilities */
  capabilities: Capability[];
  /** Payment configuration */
  payment: PaymentConfig;
  /** Optional extensions */
  extensions?: Extension[];
}

// ─────────────────────────────────────────────────────────────
// Negotiation
// ─────────────────────────────────────────────────────────────

/**
 * Agent profile for negotiation
 */
export interface AgentProfile {
  /** Capabilities the agent supports */
  capabilities: string[];
  /** Handler names the agent can use */
  handlers: string[];
  /** Extensions the agent understands */
  extensions: string[];
}

/**
 * Negotiation request
 */
export interface NegotiateRequest {
  /** Agent's profile */
  agentProfile: AgentProfile;
}

/**
 * Negotiation result
 */
export interface NegotiateResponse {
  /** Negotiated configuration */
  negotiated: {
    /** Intersection of supported capabilities */
    capabilities: Capability[];
    /** Compatible handlers */
    handlers: PaymentHandler[];
    /** Shared extensions */
    extensions: Extension[];
  };
  /** Warnings about compatibility */
  warnings?: string[];
}

// ─────────────────────────────────────────────────────────────
// Dynamic Profile Context
// ─────────────────────────────────────────────────────────────

/**
 * Context for dynamic profile generation
 */
export interface ProfileContext {
  /** Cart amount in minor units */
  cartAmount?: number;
  /** Currency code */
  currency?: string;
  /** Buyer's country code */
  buyerCountry?: string;
  /** Product categories in cart */
  productCategories?: string[];
}

// ─────────────────────────────────────────────────────────────
// Transport Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Transport configuration for profile builder
 */
export interface TransportConfig {
  /** REST API endpoint */
  rest?: { endpoint: string; schema?: string };
  /** MCP endpoint */
  mcp?: { endpoint: string; schema?: string };
  /** A2A endpoint */
  a2a?: { endpoint: string };
  /** Embedded schema */
  embedded?: { schema: string };
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/**
 * Well-known capability names
 */
export const CAPABILITY_NAMES = {
  CHECKOUT: 'dev.ucp.shopping.checkout',
  IDENTITY: 'dev.ucp.shopping.identity',
  ORDERS: 'dev.ucp.shopping.orders',
} as const;

/**
 * Well-known extension names
 */
export const EXTENSION_NAMES = {
  FULFILLMENT: 'dev.ucp.shopping.fulfillment',
  DISCOUNTS: 'dev.ucp.shopping.discounts',
  WIX_LOYALTY: 'com.wix.loyalty',
} as const;

/**
 * Cache TTL for profiles (5 minutes)
 */
export const PROFILE_CACHE_TTL = 300;
