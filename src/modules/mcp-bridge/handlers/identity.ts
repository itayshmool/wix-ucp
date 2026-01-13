/**
 * Identity Tool Handlers
 * 
 * MCP handlers for identity and session operations.
 */

import { getSessionManager } from '../session.js';
import type { MCPContext, MCPToolResult, ToolHandler } from '../types.js';

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function createTextResult(data: unknown): MCPToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function createErrorResult(message: string): MCPToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: true, message }),
      },
    ],
    isError: true,
  };
}

// ─────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────

const createVisitorSession: ToolHandler = async (args, context) => {
  const sessionManager = getSessionManager();

  try {
    const session = await sessionManager.createVisitorSession();

    return createTextResult({
      sessionId: session.id,
      visitorToken: session.visitorToken,
      expiresAt: session.expiresAt.toISOString(),
      message: 'Visitor session created. You can now browse products and create checkouts.',
      capabilities: [
        'Browse products',
        'Create checkout sessions',
        'View orders with order ID',
      ],
      upgradePath: 'Use linkIdentity to connect to a member account for personalized features',
    });
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error.message : 'Failed to create session'
    );
  }
};

const linkIdentity: ToolHandler = async (args, context) => {
  const email = args.email as string | undefined;

  if (!email) {
    return createErrorResult('email is required');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return createErrorResult('Invalid email format');
  }

  const sessionManager = getSessionManager();

  try {
    // In production, this would:
    // 1. Initiate OAuth flow
    // 2. Get member credentials
    // 3. Upgrade session

    // Mock the identity linking
    const session = await sessionManager.upgradeToMember(context.session.id, {
      email,
      accessToken: `member_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    });

    if (!session) {
      return createErrorResult('Session not found');
    }

    return createTextResult({
      success: true,
      sessionId: session.id,
      email,
      message: `Identity linked successfully for ${email}`,
      newCapabilities: [
        'View order history',
        'Access saved addresses',
        'Use saved payment methods',
        'Manage loyalty points',
      ],
      hint: 'Use listOrders to see your order history',
    });
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error.message : 'Failed to link identity'
    );
  }
};

const getMemberInfo: ToolHandler = async (args, context) => {
  const sessionManager = getSessionManager();

  // Check if session has member token
  if (!sessionManager.isMemberSession(context.session)) {
    return createTextResult({
      authenticated: false,
      message: 'Not logged in. Use linkIdentity to connect to a member account.',
      hint: 'linkIdentity requires your email address to start the authentication flow',
    });
  }

  // Return mock member info
  return createTextResult({
    authenticated: true,
    member: {
      id: 'member_123',
      email: 'member@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
    },
    loyalty: {
      tier: 'Gold',
      points: 1500,
      lifetimePoints: 5000,
    },
    savedAddresses: [
      {
        id: 'addr_1',
        label: 'Home',
        line1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'US',
        isDefault: true,
      },
    ],
    savedPaymentMethods: [
      {
        id: 'pm_1',
        type: 'card',
        brand: 'Visa',
        last4: '4242',
        isDefault: true,
      },
    ],
    message: 'Member profile loaded successfully',
    availableActions: [
      'View order history with listOrders',
      'Create checkout with saved info',
      'Update profile information',
    ],
  });
};

// ─────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────

export const identityHandlers: Record<string, ToolHandler> = {
  createVisitorSession,
  linkIdentity,
  getMemberInfo,
};
