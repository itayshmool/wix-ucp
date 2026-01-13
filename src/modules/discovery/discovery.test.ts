/**
 * Discovery Module Tests
 * 
 * Unit tests for profile builder, registries, and negotiation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  UCPProfileBuilder,
  createProfileBuilder,
  applyProfileContext,
  createDefaultWixProfile,
} from './profile-builder.js';
import {
  CapabilityRegistry,
  createCapabilityRegistry,
  registerDefaultCapabilities,
} from './capability-registry.js';
import {
  PaymentHandlerRegistry,
  createHandlerRegistry,
  registerWixPaymentsHandler,
} from './handler-registry.js';
import {
  negotiate,
  buildNegotiateResponse,
  validateAgentProfile,
  isViableForCheckout,
  scoreNegotiation,
} from './negotiation.js';
import type { UCPProfile, Capability, AgentProfile } from './types.js';
import type { PaymentHandler } from '../../core/types/payment.js';

describe('Discovery Module', () => {
  // ─────────────────────────────────────────────────────────────
  // Profile Builder Tests
  // ─────────────────────────────────────────────────────────────

  describe('UCPProfileBuilder', () => {
    let builder: UCPProfileBuilder;

    beforeEach(() => {
      builder = createProfileBuilder();
    });

    it('should build a minimal profile', () => {
      const profile = builder
        .setBusinessInfo({
          id: 'site_123',
          name: 'Test Store',
          currency: 'USD',
        })
        .build();

      expect(profile.ucp.version).toBe('2026-01-11');
      expect(profile.business.id).toBe('site_123');
      expect(profile.business.name).toBe('Test Store');
      expect(profile.capabilities).toEqual([]);
      expect(profile.payment.handlers).toEqual([]);
    });

    it('should throw when business info is missing', () => {
      expect(() => builder.build()).toThrow('Business info is required');
    });

    it('should add capabilities without duplicates', () => {
      const capability: Capability = {
        name: 'dev.ucp.shopping.checkout',
        version: '2026-01-11',
        spec: 'https://ucp.dev/specification/checkout',
      };

      builder
        .setBusinessInfo({ id: 'test', name: 'Test', currency: 'USD' })
        .addCapability(capability)
        .addCapability(capability); // Duplicate

      const profile = builder.build();
      expect(profile.capabilities).toHaveLength(1);
    });

    it('should add payment handlers without duplicates', () => {
      const handler: PaymentHandler = {
        id: 'handler_1',
        name: 'com.wix.payments',
        version: '2026-01-11',
        spec: 'https://example.com',
      };

      builder
        .setBusinessInfo({ id: 'test', name: 'Test', currency: 'USD' })
        .addPaymentHandler(handler)
        .addPaymentHandler(handler); // Duplicate

      const profile = builder.build();
      expect(profile.payment.handlers).toHaveLength(1);
    });

    it('should set transports correctly', () => {
      const profile = builder
        .setBusinessInfo({ id: 'test', name: 'Test', currency: 'USD' })
        .setTransports({
          rest: { endpoint: 'https://api.example.com/ucp/v1' },
          mcp: { endpoint: 'https://api.example.com/mcp' },
        })
        .build();

      expect(profile.ucp.services['dev.ucp.shopping']?.rest?.endpoint).toBe(
        'https://api.example.com/ucp/v1'
      );
      expect(profile.ucp.services['dev.ucp.shopping']?.mcp?.endpoint).toBe(
        'https://api.example.com/mcp'
      );
    });

    it('should reset builder state', () => {
      builder
        .setBusinessInfo({ id: 'test', name: 'Test', currency: 'USD' })
        .addCapability({ name: 'cap1', version: '1.0', spec: 'http://x' })
        .reset();

      expect(() => builder.build()).toThrow('Business info is required');
    });

    it('should build minimal profile without validation', () => {
      const profile = builder.buildMinimal();

      expect(profile.business.id).toBe('unknown');
      expect(profile.business.name).toBe('Unknown Business');
    });
  });

  describe('applyProfileContext', () => {
    const baseProfile: UCPProfile = {
      ucp: { version: '2026-01-11', services: {} },
      business: { id: 'test', name: 'Test', currency: 'USD' },
      capabilities: [],
      payment: {
        handlers: [
          {
            id: 'h1',
            name: 'regular',
            version: '1.0',
            spec: 'http://x',
            config: { supportedCurrencies: ['USD', 'EUR'] },
          },
          {
            id: 'h2',
            name: 'eur_only',
            version: '1.0',
            spec: 'http://x',
            config: { supportedCurrencies: ['EUR'] },
          },
          {
            id: 'h3',
            name: 'afterpay_bnpl',
            version: '1.0',
            spec: 'http://x',
            config: { supportedCurrencies: ['USD'] },
          },
        ],
      },
    };

    it('should filter by currency', () => {
      const filtered = applyProfileContext(baseProfile, { currency: 'USD' });

      expect(filtered.payment.handlers).toHaveLength(2);
      expect(filtered.payment.handlers.map((h) => h.name)).not.toContain('eur_only');
    });

    it('should filter BNPL by amount', () => {
      const filtered = applyProfileContext(baseProfile, { cartAmount: 3000 }); // $30

      expect(filtered.payment.handlers.map((h) => h.name)).not.toContain('afterpay_bnpl');
    });

    it('should keep BNPL for sufficient amount', () => {
      const filtered = applyProfileContext(baseProfile, { cartAmount: 10000 }); // $100

      expect(filtered.payment.handlers.map((h) => h.name)).toContain('afterpay_bnpl');
    });
  });

  describe('createDefaultWixProfile', () => {
    it('should create a valid Wix profile', () => {
      const profile = createDefaultWixProfile(
        'site_123',
        'My Store',
        'https://api.example.com'
      );

      expect(profile.business.id).toBe('site_123');
      expect(profile.business.name).toBe('My Store');
      expect(profile.ucp.services['dev.ucp.shopping']?.rest?.endpoint).toBe(
        'https://api.example.com/ucp/v1'
      );
      expect(profile.capabilities).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Capability Registry Tests
  // ─────────────────────────────────────────────────────────────

  describe('CapabilityRegistry', () => {
    let registry: CapabilityRegistry;

    beforeEach(() => {
      registry = createCapabilityRegistry();
    });

    it('should register capabilities', () => {
      registry.register({
        name: 'test.capability',
        version: '1.0',
        spec: 'http://example.com',
      });

      expect(registry.supports('test.capability')).toBe(true);
      expect(registry.size).toBe(1);
    });

    it('should get capability by name', () => {
      registry.register({
        name: 'test.capability',
        version: '1.0',
        spec: 'http://example.com',
      });

      const cap = registry.get('test.capability');
      expect(cap?.version).toBe('1.0');
    });

    it('should list all capabilities', () => {
      registry.register({ name: 'cap1', version: '1.0', spec: 'http://x' });
      registry.register({ name: 'cap2', version: '1.0', spec: 'http://x' });

      expect(registry.list()).toHaveLength(2);
    });

    it('should list public capabilities (without handlers)', () => {
      registry.register({
        name: 'test.capability',
        version: '1.0',
        spec: 'http://example.com',
        handler: { handle: async () => ({}) },
      });

      const publicCaps = registry.listPublic();
      expect(publicCaps[0]).not.toHaveProperty('handler');
    });

    it('should unregister capabilities', () => {
      registry.register({ name: 'test', version: '1.0', spec: 'http://x' });
      expect(registry.unregister('test')).toBe(true);
      expect(registry.supports('test')).toBe(false);
    });

    it('should check multiple capabilities', () => {
      registry.register({ name: 'cap1', version: '1.0', spec: 'http://x' });
      registry.register({ name: 'cap2', version: '1.0', spec: 'http://x' });

      expect(registry.supportsAll(['cap1', 'cap2'])).toBe(true);
      expect(registry.supportsAll(['cap1', 'cap3'])).toBe(false);
      expect(registry.supportsAny(['cap1', 'cap3'])).toBe(true);
    });

    it('should clear registry', () => {
      registry.register({ name: 'test', version: '1.0', spec: 'http://x' });
      registry.clear();
      expect(registry.size).toBe(0);
    });
  });

  describe('registerDefaultCapabilities', () => {
    it('should register checkout, orders, and identity', () => {
      const registry = createCapabilityRegistry();
      registerDefaultCapabilities(registry);

      expect(registry.supports('dev.ucp.shopping.checkout')).toBe(true);
      expect(registry.supports('dev.ucp.shopping.orders')).toBe(true);
      expect(registry.supports('dev.ucp.shopping.identity')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Handler Registry Tests
  // ─────────────────────────────────────────────────────────────

  describe('PaymentHandlerRegistry', () => {
    let registry: PaymentHandlerRegistry;

    beforeEach(() => {
      registry = createHandlerRegistry();
    });

    it('should register handlers', () => {
      registry.register({
        id: 'h1',
        name: 'test.handler',
        version: '1.0',
        spec: 'http://x',
      });

      expect(registry.has('test.handler')).toBe(true);
      expect(registry.size).toBe(1);
    });

    it('should get handler by name', () => {
      registry.register({
        id: 'h1',
        name: 'test.handler',
        version: '1.0',
        spec: 'http://x',
      });

      expect(registry.get('test.handler')?.id).toBe('h1');
    });

    it('should get handler by ID', () => {
      registry.register({
        id: 'h1',
        name: 'test.handler',
        version: '1.0',
        spec: 'http://x',
      });

      expect(registry.getById('h1')?.name).toBe('test.handler');
    });

    it('should filter by currency', () => {
      registry.register({
        id: 'h1',
        name: 'usd_handler',
        version: '1.0',
        spec: 'http://x',
        config: { supportedCurrencies: ['USD'] },
      });
      registry.register({
        id: 'h2',
        name: 'eur_handler',
        version: '1.0',
        spec: 'http://x',
        config: { supportedCurrencies: ['EUR'] },
      });

      const usdHandlers = registry.filter({ supportsCurrency: 'USD' });
      expect(usdHandlers).toHaveLength(1);
      expect(usdHandlers[0].name).toBe('usd_handler');
    });

    it('should filter by payment method', () => {
      registry.register({
        id: 'h1',
        name: 'card_handler',
        version: '1.0',
        spec: 'http://x',
        config: { supportedPaymentMethods: ['creditCard'] },
      });

      const cardHandlers = registry.filter({ supportsMethod: 'creditCard' });
      expect(cardHandlers).toHaveLength(1);
    });

    it('should get handlers by names', () => {
      registry.register({ id: 'h1', name: 'handler1', version: '1.0', spec: 'http://x' });
      registry.register({ id: 'h2', name: 'handler2', version: '1.0', spec: 'http://x' });

      const handlers = registry.getByNames(['handler1', 'handler3']);
      expect(handlers).toHaveLength(1);
      expect(handlers[0].name).toBe('handler1');
    });
  });

  describe('registerWixPaymentsHandler', () => {
    it('should register Wix Payments handler', () => {
      const registry = createHandlerRegistry();
      registerWixPaymentsHandler(registry, 'merchant_123');

      expect(registry.has('com.wix.payments')).toBe(true);
      const handler = registry.get('com.wix.payments');
      expect(handler?.config?.merchantId).toBe('merchant_123');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Negotiation Tests
  // ─────────────────────────────────────────────────────────────

  describe('Negotiation', () => {
    const businessProfile: UCPProfile = {
      ucp: { version: '2026-01-11', services: {} },
      business: { id: 'test', name: 'Test', currency: 'USD' },
      capabilities: [
        { name: 'dev.ucp.shopping.checkout', version: '1.0', spec: 'http://x' },
        { name: 'dev.ucp.shopping.orders', version: '1.0', spec: 'http://x' },
      ],
      payment: {
        handlers: [
          { id: 'h1', name: 'com.wix.payments', version: '1.0', spec: 'http://x' },
          { id: 'h2', name: 'com.stripe.payments', version: '1.0', spec: 'http://x' },
        ],
      },
      extensions: [
        { name: 'dev.ucp.shopping.fulfillment', version: '1.0', spec: 'http://x' },
      ],
    };

    describe('negotiate', () => {
      it('should find intersection of capabilities', () => {
        const agentProfile: AgentProfile = {
          capabilities: ['dev.ucp.shopping.checkout'],
          handlers: ['com.wix.payments'],
          extensions: [],
        };

        const result = negotiate(businessProfile, agentProfile);

        expect(result.capabilities).toHaveLength(1);
        expect(result.capabilities[0].name).toBe('dev.ucp.shopping.checkout');
      });

      it('should find compatible handlers', () => {
        const agentProfile: AgentProfile = {
          capabilities: ['dev.ucp.shopping.checkout'],
          handlers: ['com.wix.payments', 'com.unknown.payments'],
          extensions: [],
        };

        const result = negotiate(businessProfile, agentProfile);

        expect(result.handlers).toHaveLength(1);
        expect(result.handlers[0].name).toBe('com.wix.payments');
      });

      it('should find shared extensions', () => {
        const agentProfile: AgentProfile = {
          capabilities: [],
          handlers: [],
          extensions: ['dev.ucp.shopping.fulfillment'],
        };

        const result = negotiate(businessProfile, agentProfile);

        expect(result.extensions).toHaveLength(1);
      });

      it('should add warnings for no common capabilities', () => {
        const agentProfile: AgentProfile = {
          capabilities: ['unknown.capability'],
          handlers: [],
          extensions: [],
        };

        const result = negotiate(businessProfile, agentProfile);

        expect(result.warnings).toContain('No common capabilities found');
      });

      it('should add warnings for no compatible handlers', () => {
        const agentProfile: AgentProfile = {
          capabilities: ['dev.ucp.shopping.checkout'],
          handlers: ['unknown.handler'],
          extensions: [],
        };

        const result = negotiate(businessProfile, agentProfile);

        expect(result.warnings).toContain('No compatible payment handlers found');
      });
    });

    describe('buildNegotiateResponse', () => {
      it('should build response from result', () => {
        const result = negotiate(businessProfile, {
          capabilities: ['dev.ucp.shopping.checkout'],
          handlers: ['com.wix.payments'],
          extensions: [],
        });

        const response = buildNegotiateResponse(result);

        expect(response.negotiated.capabilities).toHaveLength(1);
        expect(response.negotiated.handlers).toHaveLength(1);
        expect(response.warnings).toBeUndefined();
      });

      it('should include warnings when present', () => {
        const result = negotiate(businessProfile, {
          capabilities: [],
          handlers: [],
          extensions: [],
        });

        const response = buildNegotiateResponse(result);

        expect(response.warnings).toBeDefined();
        expect(response.warnings?.length).toBeGreaterThan(0);
      });
    });

    describe('validateAgentProfile', () => {
      it('should accept valid profile', () => {
        const errors = validateAgentProfile({
          capabilities: ['cap1'],
          handlers: ['h1'],
          extensions: [],
        });

        expect(errors).toHaveLength(0);
      });

      it('should reject non-array capabilities', () => {
        const errors = validateAgentProfile({
          capabilities: 'not-array' as unknown as string[],
          handlers: [],
          extensions: [],
        });

        expect(errors).toContain('capabilities must be an array');
      });
    });

    describe('isViableForCheckout', () => {
      it('should return true with checkout and handler', () => {
        const result = negotiate(businessProfile, {
          capabilities: ['dev.ucp.shopping.checkout'],
          handlers: ['com.wix.payments'],
          extensions: [],
        });

        expect(isViableForCheckout(result)).toBe(true);
      });

      it('should return false without checkout', () => {
        const result = negotiate(businessProfile, {
          capabilities: ['dev.ucp.shopping.orders'],
          handlers: ['com.wix.payments'],
          extensions: [],
        });

        expect(isViableForCheckout(result)).toBe(false);
      });

      it('should return false without handlers', () => {
        const result = negotiate(businessProfile, {
          capabilities: ['dev.ucp.shopping.checkout'],
          handlers: [],
          extensions: [],
        });

        expect(isViableForCheckout(result)).toBe(false);
      });
    });

    describe('scoreNegotiation', () => {
      it('should score higher for more capabilities', () => {
        const result1 = negotiate(businessProfile, {
          capabilities: ['dev.ucp.shopping.checkout'],
          handlers: ['com.wix.payments'],
          extensions: [],
        });

        const result2 = negotiate(businessProfile, {
          capabilities: ['dev.ucp.shopping.checkout', 'dev.ucp.shopping.orders'],
          handlers: ['com.wix.payments'],
          extensions: [],
        });

        expect(scoreNegotiation(result2)).toBeGreaterThan(scoreNegotiation(result1));
      });

      it('should give bonus for checkout capability', () => {
        const withCheckout = negotiate(businessProfile, {
          capabilities: ['dev.ucp.shopping.checkout'],
          handlers: [],
          extensions: [],
        });

        const withoutCheckout = negotiate(businessProfile, {
          capabilities: ['dev.ucp.shopping.orders'],
          handlers: [],
          extensions: [],
        });

        expect(scoreNegotiation(withCheckout)).toBeGreaterThan(
          scoreNegotiation(withoutCheckout)
        );
      });
    });
  });
});
