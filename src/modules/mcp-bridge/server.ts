/**
 * MCP Server Implementation
 * 
 * Implements the MCP server for Wix UCP integration.
 * See: .cursor/rules/modules/mcp-bridge.mdc
 */

import { logger } from '../../lib/logger.js';
import { env } from '../../config/env.js';
import { getSessionManager, type MCPSessionManager } from './session.js';
import { UCP_MCP_TOOLS, getTool, validateToolArgs } from './tools.js';
import type {
  MCPServerConfig,
  MCPSession,
  MCPContext,
  MCPToolResult,
  MCPCallRequest,
  MCPCallResponse,
  ToolHandler,
  MCPTool,
} from './types.js';
import { MCP_SERVER_INFO } from './types.js';

// Import handlers
import { checkoutHandlers } from './handlers/checkout.js';
import { catalogHandlers } from './handlers/catalog.js';
import { orderHandlers } from './handlers/orders.js';
import { identityHandlers } from './handlers/identity.js';

// ─────────────────────────────────────────────────────────────
// MCP Server
// ─────────────────────────────────────────────────────────────

export class WixUCPMCPServer {
  private config: MCPServerConfig;
  private sessionManager: MCPSessionManager;
  private toolHandlers: Map<string, ToolHandler>;

  constructor(config: Partial<MCPServerConfig> = {}) {
    this.config = {
      name: config.name ?? MCP_SERVER_INFO.name,
      version: config.version ?? MCP_SERVER_INFO.version,
      siteId: config.siteId ?? env.WIX_SITE_ID ?? 'default',
      sessionTTL: config.sessionTTL,
    };

    this.sessionManager = getSessionManager();
    this.toolHandlers = new Map();

    this.registerAllHandlers();
  }

  // ─────────────────────────────────────────────────────────────
  // Handler Registration
  // ─────────────────────────────────────────────────────────────

  private registerAllHandlers(): void {
    // Register checkout handlers
    for (const [name, handler] of Object.entries(checkoutHandlers)) {
      this.toolHandlers.set(name, handler);
    }

    // Register catalog handlers
    for (const [name, handler] of Object.entries(catalogHandlers)) {
      this.toolHandlers.set(name, handler);
    }

    // Register order handlers
    for (const [name, handler] of Object.entries(orderHandlers)) {
      this.toolHandlers.set(name, handler);
    }

    // Register identity handlers
    for (const [name, handler] of Object.entries(identityHandlers)) {
      this.toolHandlers.set(name, handler);
    }

    logger.info(
      { toolCount: this.toolHandlers.size },
      'MCP handlers registered'
    );
  }

  /**
   * Register a custom tool handler
   */
  registerHandler(name: string, handler: ToolHandler): void {
    this.toolHandlers.set(name, handler);
  }

  // ─────────────────────────────────────────────────────────────
  // Tool Management
  // ─────────────────────────────────────────────────────────────

  /**
   * Get all tool definitions
   */
  getToolDefinitions(): MCPTool[] {
    return UCP_MCP_TOOLS;
  }

  /**
   * Get server info
   */
  getServerInfo(): { name: string; version: string } {
    return {
      name: this.config.name,
      version: this.config.version,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // HTTP Call Handler
  // ─────────────────────────────────────────────────────────────

  /**
   * Handle an MCP tool call via HTTP
   */
  async handleCall(request: MCPCallRequest): Promise<MCPCallResponse> {
    const { tool, arguments: args, sessionId } = request;

    // Get or create session
    const session = await this.sessionManager.getOrCreateSession(sessionId);

    // Create context
    const context: MCPContext = {
      session,
      siteId: this.config.siteId,
      currency: 'USD',
    };

    // Get handler
    const handler = this.toolHandlers.get(tool);
    if (!handler) {
      return {
        sessionId: session.id,
        result: this.createErrorResult(`Unknown tool: ${tool}`),
      };
    }

    // Validate arguments
    const toolDef = getTool(tool);
    if (toolDef) {
      const validation = validateToolArgs(toolDef, args);
      if (!validation.valid) {
        return {
          sessionId: session.id,
          result: this.createErrorResult(
            `Invalid arguments: ${validation.errors.join(', ')}`
          ),
        };
      }
    }

    // Execute handler
    try {
      const result = await handler(args, context);

      // Update session if needed (e.g., store checkout ID)
      if (tool === 'createCheckout' && result.content[0]?.text) {
        try {
          const parsed = JSON.parse(result.content[0].text);
          if (parsed.checkoutId) {
            await this.sessionManager.setCheckoutId(session.id, parsed.checkoutId);
          }
        } catch {
          // Ignore parse errors
        }
      }

      return {
        sessionId: session.id,
        result,
      };
    } catch (error) {
      logger.error({ error, tool, sessionId: session.id }, 'MCP tool call failed');
      return {
        sessionId: session.id,
        result: this.createErrorResult(
          error instanceof Error ? error.message : 'Tool execution failed'
        ),
      };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SSE Handler
  // ─────────────────────────────────────────────────────────────

  /**
   * Create SSE message format
   */
  createSSEMessage(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  /**
   * Get initial SSE messages (server info and tools)
   */
  getInitialSSEMessages(sessionId: string): string[] {
    const messages: string[] = [];

    // Server info
    messages.push(this.createSSEMessage('server_info', {
      ...this.getServerInfo(),
      sessionId,
    }));

    // Available tools
    messages.push(this.createSSEMessage('tools', {
      tools: this.getToolDefinitions(),
    }));

    return messages;
  }

  // ─────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Create error result
   */
  private createErrorResult(message: string): MCPToolResult {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: true,
            message,
            suggestion: this.getSuggestion(message),
          }),
        },
      ],
      isError: true,
    };
  }

  /**
   * Get suggestion for error
   */
  private getSuggestion(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('not found')) {
      return 'The requested resource does not exist. Please verify the ID.';
    }
    if (lowerMessage.includes('invalid')) {
      return 'Please check the input parameters.';
    }
    if (lowerMessage.includes('unauthorized') || lowerMessage.includes('auth')) {
      return 'Authentication is required. Create a visitor session first.';
    }
    if (lowerMessage.includes('unknown tool')) {
      return `Available tools: ${UCP_MCP_TOOLS.map(t => t.name).join(', ')}`;
    }

    return 'Please try again or contact support.';
  }

  /**
   * Get session manager
   */
  getSessionManager(): MCPSessionManager {
    return this.sessionManager;
  }
}

// ─────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────

let mcpServer: WixUCPMCPServer | null = null;

export function getMCPServer(): WixUCPMCPServer {
  if (!mcpServer) {
    mcpServer = new WixUCPMCPServer();
  }
  return mcpServer;
}

export function createMCPServer(config?: Partial<MCPServerConfig>): WixUCPMCPServer {
  return new WixUCPMCPServer(config);
}
