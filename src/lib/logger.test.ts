/**
 * Logger Tests
 * 
 * Following TDD principles from practices/tdd.mdc
 * This verifies the test setup is working correctly.
 */

import { describe, it, expect } from 'vitest';
import { logger } from './logger.js';

describe('Logger', () => {
  it('should be defined', () => {
    expect(logger).toBeDefined();
  });

  it('should have standard log methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should have correct log level in test environment', () => {
    // In test environment, log level should be 'error' to reduce noise
    // This is set in tests/setup.ts
    expect(process.env.LOG_LEVEL).toBe('error');
  });
});
