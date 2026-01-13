/**
 * Vitest Global Setup
 * 
 * This file runs before all tests.
 * Use for:
 * - Setting up test environment variables
 * - Mocking global dependencies
 * - Database/Redis setup for integration tests
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Environment Setup
// ─────────────────────────────────────────────────────────────

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Suppress logs during tests

// Mock required env vars for unit tests
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.WIX_API_KEY = 'test-wix-api-key';
process.env.WIX_ACCOUNT_ID = 'test-account-id';
process.env.WIX_SITE_ID = 'test-site-id';

// ─────────────────────────────────────────────────────────────
// Global Hooks
// ─────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Global setup before all tests
  // Add database/redis connections for integration tests here
});

afterAll(async () => {
  // Global cleanup after all tests
  // Close database/redis connections here
});

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────
// Global Test Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Helper to create a mock Fastify request
 */
export function createMockRequest(overrides = {}) {
  return {
    method: 'GET',
    url: '/test',
    headers: {},
    params: {},
    query: {},
    body: {},
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    ...overrides,
  };
}

/**
 * Helper to create a mock Fastify reply
 */
export function createMockReply() {
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    setCookie: vi.fn().mockReturnThis(),
    code: vi.fn().mockReturnThis(),
  };
  return reply;
}

// ─────────────────────────────────────────────────────────────
// Time Mocking Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Setup fake timers for time-dependent tests
 */
export function setupFakeTimers(date: Date = new Date('2026-01-01T12:00:00Z')) {
  vi.useFakeTimers();
  vi.setSystemTime(date);
}

/**
 * Restore real timers
 */
export function restoreFakeTimers() {
  vi.useRealTimers();
}
