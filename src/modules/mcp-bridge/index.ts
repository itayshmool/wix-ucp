/**
 * MCP Bridge Module
 * 
 * Bridges Wix MCP to UCP protocol.
 * See: .cursor/rules/modules/mcp-bridge.mdc
 */

// Types
export * from './types.js';

// Tools
export {
  UCP_MCP_TOOLS,
  getTool,
  getToolNames,
  validateToolArgs,
} from './tools.js';

// Session Manager
export {
  MCPSessionManager,
  getSessionManager,
  createSessionManager,
} from './session.js';

// Server
export {
  WixUCPMCPServer,
  getMCPServer,
  createMCPServer,
} from './server.js';

// Handlers
export { checkoutHandlers } from './handlers/checkout.js';
export { catalogHandlers } from './handlers/catalog.js';
export { orderHandlers } from './handlers/orders.js';
export { identityHandlers } from './handlers/identity.js';

// Routes
export { mcpRoutes } from './routes.js';
