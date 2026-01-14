/**
 * Test UI Routes
 * Serves the test console UI and provides a simplified MCP tool execution endpoint
 * 
 * This routes file uses the actual MCP handlers (which respect DEMO_MODE)
 * instead of hardcoded mock data.
 */

import type { FastifyInstance, FastifyReply } from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { logger } from '../lib/logger.js';

// Import actual MCP handlers and types
import { catalogHandlers } from '../modules/mcp-bridge/handlers/catalog.js';
import { checkoutHandlers } from '../modules/mcp-bridge/handlers/checkout.js';
import { orderHandlers } from '../modules/mcp-bridge/handlers/orders.js';
import { identityHandlers } from '../modules/mcp-bridge/handlers/identity.js';
import type { ToolHandler, MCPContext } from '../modules/mcp-bridge/types.js';

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
 * All available tool handlers from MCP Bridge
 */
const ALL_HANDLERS: Record<string, ToolHandler> = {
  // Catalog handlers
  ...catalogHandlers,
  // Checkout handlers  
  ...checkoutHandlers,
  // Order handlers
  ...orderHandlers,
  // Identity handlers
  ...identityHandlers,
};

/**
 * Execute an MCP tool using the real handlers
 */
async function executeMCPTool(
  tool: string,
  args: Record<string, unknown>
): Promise<MCPCallResponse> {
  const handler = ALL_HANDLERS[tool];

  if (!handler) {
    return {
      success: false,
      error: `Unknown tool: ${tool}. Available tools: ${Object.keys(ALL_HANDLERS).join(', ')}`,
    };
  }

  try {
    // Create a minimal context for the handlers
    const context: MCPContext = {
      session: {
        id: 'test-ui-session',
        visitorToken: undefined,
        memberToken: undefined,
        checkoutId: undefined,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
      siteId: 'test-ui',
      locale: 'en-US',
      currency: 'USD',
    };

    const result = await handler(args, context);
    
    // The handler returns MCPToolResult format, extract the text content
    if (result && typeof result === 'object' && 'content' in result) {
      const mcpResult = result as { content: Array<{ type: string; text: string }>; isError?: boolean };
      
      if (mcpResult.isError) {
        const errorText = mcpResult.content[0]?.text || 'Unknown error';
        try {
          const parsed = JSON.parse(errorText);
          return { success: false, error: parsed.message || errorText };
        } catch {
          return { success: false, error: errorText };
        }
      }
      
      // Parse the JSON text from the result
      const text = mcpResult.content[0]?.text;
      if (text) {
        try {
          const parsed = JSON.parse(text);
          return { success: true, result: parsed };
        } catch {
          return { success: true, result: text };
        }
      }
    }
    
    return { success: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ tool, args, error }, 'MCP tool execution failed');
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

  // MCP tool call endpoint (for test UI) - NOW USES REAL HANDLERS!
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
    const tools = Object.keys(ALL_HANDLERS).map((name) => ({
      name,
      description: `MCP tool: ${name}`,
    }));

    return reply.status(200).send({ tools });
  });

  done();
}

export default testUIRoutes;
