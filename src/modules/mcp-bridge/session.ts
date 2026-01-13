/**
 * MCP Session Manager
 * 
 * Manages visitor and member sessions for MCP connections.
 * See: .cursor/rules/modules/mcp-bridge.mdc
 */

import { randomUUID } from 'crypto';
import { getRedis, setWithTTL, getJSON, deleteKey } from '../../lib/redis.js';
import { logger } from '../../lib/logger.js';
import type { MCPSession, StoredSession, MemberCredentials } from './types.js';
import { SESSION_TTL } from './types.js';

// ─────────────────────────────────────────────────────────────
// Redis Keys
// ─────────────────────────────────────────────────────────────

const REDIS_PREFIX = 'mcp:session:';

function sessionKey(sessionId: string): string {
  return `${REDIS_PREFIX}${sessionId}`;
}

// ─────────────────────────────────────────────────────────────
// Session Manager
// ─────────────────────────────────────────────────────────────

export class MCPSessionManager {
  private sessionTTL: number;

  constructor(sessionTTL: number = SESSION_TTL) {
    this.sessionTTL = sessionTTL;
  }

  // ─────────────────────────────────────────────────────────────
  // Create Session
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a new visitor session
   */
  async createVisitorSession(): Promise<MCPSession> {
    const sessionId = `mcp_${randomUUID().replace(/-/g, '')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTTL * 1000);

    // Generate a simple visitor token (in production, use Wix visitor tokens)
    const visitorToken = `vis_${randomUUID().replace(/-/g, '')}`;

    const session: MCPSession = {
      id: sessionId,
      visitorToken,
      createdAt: now,
      expiresAt,
    };

    // Store in Redis
    const storedSession: StoredSession = {
      id: session.id,
      visitorToken: session.visitorToken,
      memberToken: session.memberToken,
      checkoutId: session.checkoutId,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    };

    await setWithTTL(sessionKey(sessionId), storedSession, this.sessionTTL);

    logger.info({ sessionId }, 'Created MCP visitor session');

    return session;
  }

  // ─────────────────────────────────────────────────────────────
  // Get Session
  // ─────────────────────────────────────────────────────────────

  /**
   * Get existing session
   */
  async getSession(sessionId: string): Promise<MCPSession | null> {
    const stored = await getJSON<StoredSession>(sessionKey(sessionId));

    if (!stored) {
      return null;
    }

    // Check if expired
    if (new Date(stored.expiresAt) < new Date()) {
      await this.deleteSession(sessionId);
      return null;
    }

    return {
      id: stored.id,
      visitorToken: stored.visitorToken,
      memberToken: stored.memberToken,
      checkoutId: stored.checkoutId,
      createdAt: new Date(stored.createdAt),
      expiresAt: new Date(stored.expiresAt),
    };
  }

  /**
   * Get or create session
   */
  async getOrCreateSession(sessionId?: string): Promise<MCPSession> {
    if (sessionId) {
      const existing = await this.getSession(sessionId);
      if (existing) {
        return existing;
      }
    }

    return this.createVisitorSession();
  }

  // ─────────────────────────────────────────────────────────────
  // Update Session
  // ─────────────────────────────────────────────────────────────

  /**
   * Update session data
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Pick<MCPSession, 'checkoutId' | 'memberToken'>>
  ): Promise<MCPSession | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const updatedSession: MCPSession = {
      ...session,
      ...updates,
    };

    const storedSession: StoredSession = {
      id: updatedSession.id,
      visitorToken: updatedSession.visitorToken,
      memberToken: updatedSession.memberToken,
      checkoutId: updatedSession.checkoutId,
      createdAt: updatedSession.createdAt.toISOString(),
      expiresAt: updatedSession.expiresAt.toISOString(),
    };

    // Calculate remaining TTL
    const remainingTTL = Math.max(
      0,
      Math.floor((updatedSession.expiresAt.getTime() - Date.now()) / 1000)
    );

    await setWithTTL(sessionKey(sessionId), storedSession, remainingTTL);

    return updatedSession;
  }

  /**
   * Set checkout ID on session
   */
  async setCheckoutId(sessionId: string, checkoutId: string): Promise<MCPSession | null> {
    return this.updateSession(sessionId, { checkoutId });
  }

  // ─────────────────────────────────────────────────────────────
  // Upgrade Session
  // ─────────────────────────────────────────────────────────────

  /**
   * Upgrade to member session
   */
  async upgradeToMember(
    sessionId: string,
    credentials: MemberCredentials
  ): Promise<MCPSession | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const updatedSession = await this.updateSession(sessionId, {
      memberToken: credentials.accessToken,
    });

    if (updatedSession) {
      logger.info(
        { sessionId, email: credentials.email },
        'Upgraded MCP session to member'
      );
    }

    return updatedSession;
  }

  // ─────────────────────────────────────────────────────────────
  // Delete Session
  // ─────────────────────────────────────────────────────────────

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const result = await deleteKey(sessionKey(sessionId));
    if (result) {
      logger.debug({ sessionId }, 'Deleted MCP session');
    }
    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // Token Helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Get Wix API token for session
   * Uses member token if available, otherwise visitor token
   */
  getWixToken(session: MCPSession): string {
    return session.memberToken ?? session.visitorToken ?? '';
  }

  /**
   * Check if session has member authentication
   */
  isMemberSession(session: MCPSession): boolean {
    return !!session.memberToken;
  }

  /**
   * Refresh session expiry
   */
  async refreshSession(sessionId: string): Promise<MCPSession | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    // Extend expiry
    const newExpiresAt = new Date(Date.now() + this.sessionTTL * 1000);

    const storedSession: StoredSession = {
      id: session.id,
      visitorToken: session.visitorToken,
      memberToken: session.memberToken,
      checkoutId: session.checkoutId,
      createdAt: session.createdAt.toISOString(),
      expiresAt: newExpiresAt.toISOString(),
    };

    await setWithTTL(sessionKey(sessionId), storedSession, this.sessionTTL);

    return {
      ...session,
      expiresAt: newExpiresAt,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton
// ─────────────────────────────────────────────────────────────

let sessionManager: MCPSessionManager | null = null;

export function getSessionManager(): MCPSessionManager {
  if (!sessionManager) {
    sessionManager = new MCPSessionManager();
  }
  return sessionManager;
}

export function createSessionManager(sessionTTL?: number): MCPSessionManager {
  return new MCPSessionManager(sessionTTL);
}
