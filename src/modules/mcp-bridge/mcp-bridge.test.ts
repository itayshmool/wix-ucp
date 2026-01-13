/**
 * MCP Bridge Tests
 * 
 * Unit tests for MCP types, tools, session, and server.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  UCP_MCP_TOOLS,
  getTool,
  getToolNames,
  validateToolArgs,
} from './tools.js';
import { MCP_SERVER_INFO, SESSION_TTL, WIX_STORES_APP_ID } from './types.js';
import type { MCPTool, MCPSession, MCPContext } from './types.js';

// Mock Redis
vi.mock('../../lib/redis.js', () => ({
  getRedis: vi.fn(() => ({
    setex: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  })),
  setWithTTL: vi.fn(),
  getJSON: vi.fn(),
  deleteKey: vi.fn(() => true),
}));

describe('MCP Bridge Module', () => {
  // ─────────────────────────────────────────────────────────────
  // Constants Tests
  // ─────────────────────────────────────────────────────────────

  describe('Constants', () => {
    it('should have correct server info', () => {
      expect(MCP_SERVER_INFO.name).toBe('wix-ucp-mcp');
      expect(MCP_SERVER_INFO.version).toBe('1.0.0');
    });

    it('should have 24-hour session TTL', () => {
      expect(SESSION_TTL).toBe(24 * 60 * 60);
    });

    it('should have Wix Stores app ID', () => {
      expect(WIX_STORES_APP_ID).toBe('215238eb-22a5-4c36-9e7b-e7c08025e04e');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Tools Tests
  // ─────────────────────────────────────────────────────────────

  describe('MCP Tools', () => {
    describe('UCP_MCP_TOOLS', () => {
      it('should have multiple tools defined', () => {
        expect(UCP_MCP_TOOLS.length).toBeGreaterThan(10);
      });

      it('should include profile tools', () => {
        expect(getToolNames()).toContain('getBusinessProfile');
      });

      it('should include catalog tools', () => {
        expect(getToolNames()).toContain('searchProducts');
        expect(getToolNames()).toContain('getProduct');
      });

      it('should include checkout tools', () => {
        expect(getToolNames()).toContain('createCheckout');
        expect(getToolNames()).toContain('getCheckout');
        expect(getToolNames()).toContain('updateCheckout');
        expect(getToolNames()).toContain('completeCheckout');
      });

      it('should include order tools', () => {
        expect(getToolNames()).toContain('getOrder');
        expect(getToolNames()).toContain('listOrders');
        expect(getToolNames()).toContain('getOrderTracking');
      });

      it('should include identity tools', () => {
        expect(getToolNames()).toContain('createVisitorSession');
        expect(getToolNames()).toContain('linkIdentity');
        expect(getToolNames()).toContain('getMemberInfo');
      });
    });

    describe('getTool', () => {
      it('should return tool by name', () => {
        const tool = getTool('createCheckout');
        
        expect(tool).toBeDefined();
        expect(tool?.name).toBe('createCheckout');
        expect(tool?.description).toContain('checkout');
      });

      it('should return undefined for unknown tool', () => {
        const tool = getTool('unknownTool');
        
        expect(tool).toBeUndefined();
      });
    });

    describe('getToolNames', () => {
      it('should return all tool names', () => {
        const names = getToolNames();
        
        expect(Array.isArray(names)).toBe(true);
        expect(names.length).toBe(UCP_MCP_TOOLS.length);
      });
    });

    describe('validateToolArgs', () => {
      it('should validate required fields', () => {
        const tool = getTool('getProduct')!;
        
        const result = validateToolArgs(tool, {});
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Missing required field: productId');
      });

      it('should pass with all required fields', () => {
        const tool = getTool('getProduct')!;
        
        const result = validateToolArgs(tool, { productId: 'prod_123' });
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate field types', () => {
        const tool = getTool('searchProducts')!;
        
        const result = validateToolArgs(tool, { limit: 'invalid' });
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('limit'))).toBe(true);
      });

      it('should pass with optional fields omitted', () => {
        const tool = getTool('searchProducts')!;
        
        const result = validateToolArgs(tool, {});
        
        expect(result.valid).toBe(true);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Tool Schema Tests
  // ─────────────────────────────────────────────────────────────

  describe('Tool Schemas', () => {
    it('all tools should have name', () => {
      UCP_MCP_TOOLS.forEach(tool => {
        expect(tool.name).toBeTruthy();
        expect(typeof tool.name).toBe('string');
      });
    });

    it('all tools should have description', () => {
      UCP_MCP_TOOLS.forEach(tool => {
        expect(tool.description).toBeTruthy();
        expect(typeof tool.description).toBe('string');
      });
    });

    it('all tools should have inputSchema', () => {
      UCP_MCP_TOOLS.forEach(tool => {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      });
    });

    describe('createCheckout schema', () => {
      it('should require lineItems', () => {
        const tool = getTool('createCheckout')!;
        
        expect(tool.inputSchema.required).toContain('lineItems');
      });

      it('should have lineItems as array', () => {
        const tool = getTool('createCheckout')!;
        
        expect(tool.inputSchema.properties.lineItems.type).toBe('array');
      });
    });

    describe('completeCheckout schema', () => {
      it('should require all payment fields', () => {
        const tool = getTool('completeCheckout')!;
        
        expect(tool.inputSchema.required).toContain('checkoutId');
        expect(tool.inputSchema.required).toContain('paymentToken');
        expect(tool.inputSchema.required).toContain('handlerId');
      });
    });

    describe('getOrder schema', () => {
      it('should require orderId', () => {
        const tool = getTool('getOrder')!;
        
        expect(tool.inputSchema.required).toContain('orderId');
      });
    });

    describe('linkIdentity schema', () => {
      it('should require email', () => {
        const tool = getTool('linkIdentity')!;
        
        expect(tool.inputSchema.required).toContain('email');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Session Types Tests
  // ─────────────────────────────────────────────────────────────

  describe('Session Types', () => {
    it('MCPSession should have required properties', () => {
      const session: MCPSession = {
        id: 'mcp_123',
        visitorToken: 'vis_abc',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + SESSION_TTL * 1000),
      };

      expect(session.id).toBeTruthy();
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
    });

    it('MCPSession can have optional memberToken', () => {
      const session: MCPSession = {
        id: 'mcp_123',
        visitorToken: 'vis_abc',
        memberToken: 'member_token',
        checkoutId: 'checkout_123',
        createdAt: new Date(),
        expiresAt: new Date(),
      };

      expect(session.memberToken).toBe('member_token');
      expect(session.checkoutId).toBe('checkout_123');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Context Types Tests
  // ─────────────────────────────────────────────────────────────

  describe('Context Types', () => {
    it('MCPContext should have session and siteId', () => {
      const context: MCPContext = {
        session: {
          id: 'mcp_123',
          visitorToken: 'vis_abc',
          createdAt: new Date(),
          expiresAt: new Date(),
        },
        siteId: 'site_123',
      };

      expect(context.session).toBeDefined();
      expect(context.siteId).toBe('site_123');
    });

    it('MCPContext can have optional locale and currency', () => {
      const context: MCPContext = {
        session: {
          id: 'mcp_123',
          createdAt: new Date(),
          expiresAt: new Date(),
        },
        siteId: 'site_123',
        locale: 'en-US',
        currency: 'USD',
      };

      expect(context.locale).toBe('en-US');
      expect(context.currency).toBe('USD');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Tool Result Tests
  // ─────────────────────────────────────────────────────────────

  describe('Tool Results', () => {
    it('should format successful result', () => {
      const result = {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ checkoutId: '123', status: 'created' }),
          },
        ],
      };

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.isError).toBeUndefined();
    });

    it('should format error result', () => {
      const result = {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: true, message: 'Not found' }),
          },
        ],
        isError: true,
      };

      expect(result.isError).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // SSE Format Tests
  // ─────────────────────────────────────────────────────────────

  describe('SSE Format', () => {
    it('should format SSE message correctly', () => {
      const event = 'server_info';
      const data = { name: 'wix-ucp-mcp', version: '1.0.0' };
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

      expect(message).toContain('event: server_info');
      expect(message).toContain('data: ');
      expect(message.endsWith('\n\n')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Tool Categories Tests
  // ─────────────────────────────────────────────────────────────

  describe('Tool Categories', () => {
    const catalogTools = ['searchProducts', 'getProduct', 'getBusinessProfile'];
    const checkoutTools = ['createCheckout', 'getCheckout', 'updateCheckout', 'getPaymentHandlers', 'completeCheckout', 'getEmbeddedCheckoutUrl'];
    const orderTools = ['getOrder', 'listOrders', 'getOrderTracking'];
    const identityTools = ['createVisitorSession', 'linkIdentity', 'getMemberInfo'];

    it('should have all catalog tools', () => {
      catalogTools.forEach(name => {
        expect(getToolNames()).toContain(name);
      });
    });

    it('should have all checkout tools', () => {
      checkoutTools.forEach(name => {
        expect(getToolNames()).toContain(name);
      });
    });

    it('should have all order tools', () => {
      orderTools.forEach(name => {
        expect(getToolNames()).toContain(name);
      });
    });

    it('should have all identity tools', () => {
      identityTools.forEach(name => {
        expect(getToolNames()).toContain(name);
      });
    });
  });
});
