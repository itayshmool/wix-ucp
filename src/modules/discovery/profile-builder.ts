/**
 * UCP Profile Builder
 * 
 * Fluent builder for constructing UCP business profiles.
 * See: .cursor/rules/modules/discovery.mdc
 */

import { UCP_PROTOCOL, UCP_SPEC_URL } from '../../core/constants.js';
import type { PaymentHandler } from '../../core/types/payment.js';
import type {
  UCPProfile,
  UCPInfo,
  BusinessInfo,
  Capability,
  Extension,
  PaymentConfig,
  TransportConfig,
  ServiceDefinition,
  ProfileContext,
} from './types.js';

/**
 * UCP Profile Builder
 * 
 * Provides a fluent interface for constructing UCP business profiles.
 */
export class UCPProfileBuilder {
  private ucpInfo: UCPInfo;
  private business: BusinessInfo | null = null;
  private capabilities: Capability[] = [];
  private handlers: PaymentHandler[] = [];
  private extensions: Extension[] = [];

  constructor() {
    // Initialize with default UCP info
    this.ucpInfo = {
      version: UCP_PROTOCOL.version,
      services: {},
    };
  }

  /**
   * Set UCP protocol version
   */
  setVersion(version: string): this {
    this.ucpInfo.version = version;
    return this;
  }

  /**
   * Set business information
   */
  setBusinessInfo(info: BusinessInfo): this {
    this.business = info;
    return this;
  }

  /**
   * Add a capability to the profile
   */
  addCapability(capability: Capability): this {
    // Avoid duplicates
    if (!this.capabilities.find((c) => c.name === capability.name)) {
      this.capabilities.push(capability);
    }
    return this;
  }

  /**
   * Add multiple capabilities
   */
  addCapabilities(capabilities: Capability[]): this {
    capabilities.forEach((cap) => this.addCapability(cap));
    return this;
  }

  /**
   * Add a payment handler
   */
  addPaymentHandler(handler: PaymentHandler): this {
    // Avoid duplicates
    if (!this.handlers.find((h) => h.id === handler.id)) {
      this.handlers.push(handler);
    }
    return this;
  }

  /**
   * Add multiple payment handlers
   */
  addPaymentHandlers(handlers: PaymentHandler[]): this {
    handlers.forEach((h) => this.addPaymentHandler(h));
    return this;
  }

  /**
   * Add an extension
   */
  addExtension(extension: Extension): this {
    // Avoid duplicates
    if (!this.extensions.find((e) => e.name === extension.name)) {
      this.extensions.push(extension);
    }
    return this;
  }

  /**
   * Add multiple extensions
   */
  addExtensions(extensions: Extension[]): this {
    extensions.forEach((ext) => this.addExtension(ext));
    return this;
  }

  /**
   * Set transport endpoints for the shopping service
   */
  setTransports(config: TransportConfig): this {
    const service: ServiceDefinition = {
      version: UCP_PROTOCOL.version,
      spec: UCP_SPEC_URL,
    };

    if (config.rest) {
      service.rest = {
        endpoint: config.rest.endpoint,
        schema: config.rest.schema ?? 'https://ucp.dev/services/shopping/rest.openapi.json',
      };
    }

    if (config.mcp) {
      service.mcp = {
        endpoint: config.mcp.endpoint,
        schema: config.mcp.schema ?? 'https://ucp.dev/services/shopping/mcp.openrpc.json',
      };
    }

    if (config.a2a) {
      service.a2a = { endpoint: config.a2a.endpoint };
    }

    if (config.embedded) {
      service.embedded = { schema: config.embedded.schema };
    }

    this.ucpInfo.services['dev.ucp.shopping'] = service;
    return this;
  }

  /**
   * Build the complete profile
   * 
   * @throws Error if required fields are missing
   */
  build(): UCPProfile {
    if (!this.business) {
      throw new Error('Business info is required');
    }

    return {
      ucp: this.ucpInfo,
      business: this.business,
      capabilities: this.capabilities,
      payment: {
        handlers: this.handlers,
      },
      extensions: this.extensions.length > 0 ? this.extensions : undefined,
    };
  }

  /**
   * Build a minimal profile (useful for testing)
   */
  buildMinimal(): UCPProfile {
    return {
      ucp: this.ucpInfo,
      business: this.business ?? {
        id: 'unknown',
        name: 'Unknown Business',
        currency: 'USD',
      },
      capabilities: this.capabilities,
      payment: {
        handlers: this.handlers,
      },
    };
  }

  /**
   * Reset the builder to initial state
   */
  reset(): this {
    this.ucpInfo = {
      version: UCP_PROTOCOL.version,
      services: {},
    };
    this.business = null;
    this.capabilities = [];
    this.handlers = [];
    this.extensions = [];
    return this;
  }
}

/**
 * Create a new profile builder instance
 */
export function createProfileBuilder(): UCPProfileBuilder {
  return new UCPProfileBuilder();
}

/**
 * Apply dynamic filtering to a profile based on context
 */
export function applyProfileContext(
  profile: UCPProfile,
  context: ProfileContext
): UCPProfile {
  const filtered = { ...profile };

  // Filter handlers based on context
  filtered.payment = {
    handlers: profile.payment.handlers.filter((handler) => {
      // Check currency support
      if (context.currency) {
        const supportedCurrencies = handler.config?.supportedCurrencies as string[] | undefined;
        if (supportedCurrencies && !supportedCurrencies.includes(context.currency)) {
          return false;
        }
      }

      // Check BNPL amount limits (example: min $50 for BNPL)
      if (handler.name.toLowerCase().includes('bnpl') || 
          handler.name.toLowerCase().includes('afterpay') ||
          handler.name.toLowerCase().includes('klarna')) {
        if (context.cartAmount && context.cartAmount < 5000) { // $50 in cents
          return false;
        }
      }

      return true;
    }),
  };

  return filtered;
}

/**
 * Create a default profile for Wix merchants
 */
export function createDefaultWixProfile(
  siteId: string,
  siteName: string,
  baseUrl: string
): UCPProfile {
  return createProfileBuilder()
    .setBusinessInfo({
      id: siteId,
      name: siteName,
      currency: 'USD',
      supportedCurrencies: ['USD', 'EUR', 'GBP'],
    })
    .setTransports({
      rest: { endpoint: `${baseUrl}/ucp/v1` },
      mcp: { endpoint: `${baseUrl}/mcp` },
    })
    .addCapability({
      name: 'dev.ucp.shopping.checkout',
      version: '2026-01-11',
      spec: 'https://ucp.dev/specification/checkout',
      schema: 'https://ucp.dev/schemas/shopping/checkout.json',
    })
    .addCapability({
      name: 'dev.ucp.shopping.orders',
      version: '2026-01-11',
      spec: 'https://ucp.dev/specification/orders',
      schema: 'https://ucp.dev/schemas/shopping/orders.json',
    })
    .build();
}
