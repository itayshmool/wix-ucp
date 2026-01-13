/**
 * MCP Routes
 * 
 * Fastify routes for MCP endpoints.
 * See: .cursor/rules/modules/mcp-bridge.mdc
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { logger } from '../../lib/logger.js';
import { getMCPServer, WixUCPMCPServer } from './server.js';
import type { MCPCallRequest, MCPCallResponse } from './types.js';

// ─────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────

const MCPCallRequestSchema = z.object({
  sessionId: z.string().optional(),
  tool: z.string().min(1),
  arguments: z.record(z.unknown()).default({}),
});

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

export async function mcpRoutes(fastify: FastifyInstance): Promise<void> {
  const mcpServer = getMCPServer();

  // ─────────────────────────────────────────────────────────────
  // GET /mcp - SSE endpoint
  // ─────────────────────────────────────────────────────────────

  fastify.get(
    '/mcp',
    {
      schema: {
        description: 'Server-Sent Events endpoint for MCP communication',
        tags: ['MCP'],
        querystring: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'SSE stream',
            content: {
              'text/event-stream': {},
            },
          },
        },
      },
    },
    async (request, reply) => {
      const sessionId = (request.query as { sessionId?: string }).sessionId;

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      // Get or create session
      const session = await mcpServer.getSessionManager().getOrCreateSession(sessionId);

      // Send initial messages
      const initialMessages = mcpServer.getInitialSSEMessages(session.id);
      for (const message of initialMessages) {
        reply.raw.write(message);
      }

      // Keep connection alive
      const keepAliveInterval = setInterval(() => {
        reply.raw.write(': keepalive\n\n');
      }, 30000);

      // Handle client disconnect
      request.raw.on('close', () => {
        clearInterval(keepAliveInterval);
        logger.debug({ sessionId: session.id }, 'MCP SSE connection closed');
      });

      // Don't end the response - keep it open for SSE
      // The connection will be closed when the client disconnects
    }
  );

  // ─────────────────────────────────────────────────────────────
  // POST /mcp/call - HTTP tool invocation
  // ─────────────────────────────────────────────────────────────

  fastify.post<{
    Body: MCPCallRequest;
  }>(
    '/mcp/call',
    {
      schema: {
        description: 'HTTP-based MCP tool invocation',
        tags: ['MCP'],
        body: {
          type: 'object',
          required: ['tool'],
          properties: {
            sessionId: { type: 'string' },
            tool: { type: 'string' },
            arguments: { type: 'object' },
          },
        },
        response: {
          200: {
            description: 'Tool result',
            type: 'object',
            properties: {
              sessionId: { type: 'string' },
              result: {
                type: 'object',
                properties: {
                  content: { type: 'array' },
                  isError: { type: 'boolean' },
                },
              },
            },
          },
          400: {
            description: 'Invalid request',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      const parseResult = MCPCallRequestSchema.safeParse(request.body);
      
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Invalid request body',
          details: parseResult.error.errors,
        });
      }

      const response = await mcpServer.handleCall(parseResult.data);
      return reply.send(response);
    }
  );

  // ─────────────────────────────────────────────────────────────
  // GET /mcp/tools - List available tools
  // ─────────────────────────────────────────────────────────────

  fastify.get(
    '/mcp/tools',
    {
      schema: {
        description: 'List all available MCP tools',
        tags: ['MCP'],
        response: {
          200: {
            description: 'List of tools',
            type: 'object',
            properties: {
              server: { type: 'object' },
              tools: { type: 'array' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      return reply.send({
        server: mcpServer.getServerInfo(),
        tools: mcpServer.getToolDefinitions(),
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // POST /mcp/session - Create new session
  // ─────────────────────────────────────────────────────────────

  fastify.post(
    '/mcp/session',
    {
      schema: {
        description: 'Create a new MCP session',
        tags: ['MCP'],
        response: {
          201: {
            description: 'Session created',
            type: 'object',
            properties: {
              sessionId: { type: 'string' },
              visitorToken: { type: 'string' },
              expiresAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const session = await mcpServer.getSessionManager().createVisitorSession();
      
      return reply.status(201).send({
        sessionId: session.id,
        visitorToken: session.visitorToken,
        expiresAt: session.expiresAt.toISOString(),
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // GET /mcp/session/:sessionId - Get session info
  // ─────────────────────────────────────────────────────────────

  fastify.get<{
    Params: { sessionId: string };
  }>(
    '/mcp/session/:sessionId',
    {
      schema: {
        description: 'Get MCP session information',
        tags: ['MCP'],
        params: {
          type: 'object',
          required: ['sessionId'],
          properties: {
            sessionId: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Session info',
            type: 'object',
          },
          404: {
            description: 'Session not found',
            type: 'object',
          },
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const session = await mcpServer.getSessionManager().getSession(sessionId);

      if (!session) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Session not found or expired',
        });
      }

      return reply.send({
        sessionId: session.id,
        hasVisitorToken: !!session.visitorToken,
        hasMemberToken: !!session.memberToken,
        checkoutId: session.checkoutId,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      });
    }
  );

  // ─────────────────────────────────────────────────────────────
  // DELETE /mcp/session/:sessionId - Delete session
  // ─────────────────────────────────────────────────────────────

  fastify.delete<{
    Params: { sessionId: string };
  }>(
    '/mcp/session/:sessionId',
    {
      schema: {
        description: 'Delete MCP session',
        tags: ['MCP'],
        params: {
          type: 'object',
          required: ['sessionId'],
          properties: {
            sessionId: { type: 'string' },
          },
        },
        response: {
          204: {
            description: 'Session deleted',
          },
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      await mcpServer.getSessionManager().deleteSession(sessionId);
      return reply.status(204).send();
    }
  );

  logger.info('MCP routes registered');
}
