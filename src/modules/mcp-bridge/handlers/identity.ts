/**
 * Identity Tool Handlers
 * 
 * MCP handlers for identity and session operations.
 * Uses WixEcommerceClient which respects DEMO_MODE for mock vs real APIs.
 */

import { getSessionManager } from '../session.js';
import { getWixEcommerceClient } from '../../../adapters/wix/ecommerce.js';
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
  const client = getWixEcommerceClient();

  try {
    const session = await sessionManager.createVisitorSession();

    return createTextResult({
      sessionId: session.id,
      visitorToken: session.visitorToken,
      expiresAt: session.expiresAt.toISOString(),
      mode: client.isInMockMode() ? 'demo' : 'live',
      message: 'Visitor session created. You can now browse products and create checkouts.',
      capabilities: ['Browse products', 'Create checkout sessions', 'View orders with order ID'],
      upgradePath: 'Use linkIdentity to connect to a member account for personalized features',
    });
  } catch (error) {
    return createErrorResult(error instanceof Error ? error.message : 'Failed to create session');
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
  const client = getWixEcommerceClient();

  try {
    // In production (DEMO_MODE=false), this would:
    // 1. Initiate OAuth flow
    // 2. Get member credentials from Wix
    // 3. Upgrade session

    // For now, mock the identity linking (works in both modes)
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
      mode: client.isInMockMode() ? 'demo' : 'live',
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
    return createErrorResult(error instanceof Error ? error.message : 'Failed to link identity');
  }
};

const getMemberInfo: ToolHandler = async (args, context) => {
  const sessionManager = getSessionManager();
  const client = getWixEcommerceClient();

  // Check if session has member token
  if (!sessionManager.isMemberSession(context.session)) {
    return createTextResult({
      authenticated: false,
      mode: client.isInMockMode() ? 'demo' : 'live',
      message: 'Not logged in. Use linkIdentity to connect to a member account.',
      hint: 'linkIdentity requires your email address to start the authentication flow',
    });
  }

  try {
    // Get member info using WixEcommerceClient (respects DEMO_MODE)
    // Note: memberToken is the identifier, use 'current' for current member
    const member = await client.getMember('current');

    return createTextResult({
      authenticated: true,
      member: {
        id: member.id,
        email: member.loginEmail,
        firstName: member.contact.firstName,
        lastName: member.contact.lastName,
        phone: member.contact.phones?.[0],
        status: member.status,
      },
      addresses:
        member.contact.addresses?.map((addr) => ({
          id: addr.id,
          line1: addr.addressLine1,
          city: addr.city,
          state: addr.subdivision,
          postalCode: addr.postalCode,
          country: addr.country,
        })) ?? [],
      profile: {
        nickname: member.profile.nickname,
        slug: member.profile.slug,
        photo: member.profile.photo?.url,
      },
      mode: client.isInMockMode() ? 'demo' : 'live',
      message: 'Member profile loaded successfully',
      availableActions: [
        'View order history with listOrders',
        'Create checkout with saved info',
        'Update profile information',
      ],
    });
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error.message : 'Failed to get member info'
    );
  }
};

// ─────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────

export const identityHandlers: Record<string, ToolHandler> = {
  createVisitorSession,
  linkIdentity,
  getMemberInfo,
};
