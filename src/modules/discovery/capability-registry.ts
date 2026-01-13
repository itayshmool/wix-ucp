/**
 * Capability Registry
 * 
 * Manages registration and lookup of UCP capabilities.
 * See: .cursor/rules/modules/discovery.mdc
 */

import { logger } from '../../lib/logger.js';
import type { Capability, CapabilityDefinition, CapabilityHandler } from './types.js';

/**
 * Capability Registry
 * 
 * Singleton registry for managing UCP capability implementations.
 */
export class CapabilityRegistry {
  private capabilities: Map<string, CapabilityDefinition> = new Map();

  /**
   * Register a capability implementation
   */
  register(definition: CapabilityDefinition): void {
    if (this.capabilities.has(definition.name)) {
      logger.warn(
        { capability: definition.name },
        'Overwriting existing capability registration'
      );
    }

    this.capabilities.set(definition.name, definition);

    logger.info(
      { capability: definition.name, version: definition.version },
      'Capability registered'
    );
  }

  /**
   * Unregister a capability
   */
  unregister(name: string): boolean {
    const deleted = this.capabilities.delete(name);
    
    if (deleted) {
      logger.info({ capability: name }, 'Capability unregistered');
    }

    return deleted;
  }

  /**
   * Get capability definition by name
   */
  get(name: string): CapabilityDefinition | undefined {
    return this.capabilities.get(name);
  }

  /**
   * Check if a capability is supported
   */
  supports(name: string): boolean {
    return this.capabilities.has(name);
  }

  /**
   * Get capability handler by name
   */
  getHandler(name: string): CapabilityHandler | undefined {
    return this.capabilities.get(name)?.handler;
  }

  /**
   * List all registered capabilities
   */
  list(): CapabilityDefinition[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * List capabilities as public Capability objects (without handlers)
   */
  listPublic(): Capability[] {
    return this.list().map(({ name, version, spec, schema }) => ({
      name,
      version,
      spec,
      schema,
    }));
  }

  /**
   * Get capabilities that support a specific extension
   */
  getByExtension(extensionName: string): CapabilityDefinition[] {
    return this.list().filter(
      (cap) => cap.extensions?.includes(extensionName)
    );
  }

  /**
   * Check if multiple capabilities are supported
   */
  supportsAll(names: string[]): boolean {
    return names.every((name) => this.supports(name));
  }

  /**
   * Check if any of the capabilities are supported
   */
  supportsAny(names: string[]): boolean {
    return names.some((name) => this.supports(name));
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.capabilities.clear();
    logger.info('Capability registry cleared');
  }

  /**
   * Get count of registered capabilities
   */
  get size(): number {
    return this.capabilities.size;
  }
}

/**
 * Global capability registry instance
 */
let globalRegistry: CapabilityRegistry | null = null;

/**
 * Get the global capability registry
 */
export function getCapabilityRegistry(): CapabilityRegistry {
  if (!globalRegistry) {
    globalRegistry = new CapabilityRegistry();
  }
  return globalRegistry;
}

/**
 * Create a new capability registry instance
 */
export function createCapabilityRegistry(): CapabilityRegistry {
  return new CapabilityRegistry();
}

/**
 * Register default capabilities for Wix UCP
 */
export function registerDefaultCapabilities(registry: CapabilityRegistry): void {
  // Checkout capability
  registry.register({
    name: 'dev.ucp.shopping.checkout',
    version: '2026-01-11',
    spec: 'https://ucp.dev/specification/checkout',
    schema: 'https://ucp.dev/schemas/shopping/checkout.json',
    extensions: ['dev.ucp.shopping.fulfillment', 'dev.ucp.shopping.discounts'],
  });

  // Orders capability
  registry.register({
    name: 'dev.ucp.shopping.orders',
    version: '2026-01-11',
    spec: 'https://ucp.dev/specification/orders',
    schema: 'https://ucp.dev/schemas/shopping/orders.json',
  });

  // Identity capability (if implemented)
  registry.register({
    name: 'dev.ucp.shopping.identity',
    version: '2026-01-11',
    spec: 'https://ucp.dev/specification/identity',
    schema: 'https://ucp.dev/schemas/shopping/identity.json',
  });

  logger.info('Default capabilities registered');
}
