/**
 * Core Utils - Public Exports
 * 
 * Re-exports all utility functions.
 */

// Error utilities
export {
  createUCPError,
  createFieldError,
  createMissingFieldError,
  createNotFoundError,
  createConflictError,
  createRateLimitError,
  createInternalError,
  createUnauthorizedError,
  createForbiddenError,
  mapWixErrorToUCP,
  getStatusForError,
  isRetryableError,
  zodErrorsToDetails,
  createValidationError,
} from './errors.js';

// Crypto utilities
export {
  generateBoundToken,
  verifyTokenBinding,
  isTokenBoundTo,
  generateIdempotencyKey,
  generateOAuthState,
  generateCodeVerifier,
  generateCodeChallenge,
  verifyCodeChallenge,
  generateSecureToken,
  generateAuthorizationCode,
  generateAccessToken,
  generateRefreshToken,
  hashValue,
  verifyHash,
} from './crypto.js';

// Validation utilities
export {
  validate,
  validateOrThrow,
  parseBody,
  parseQuery,
  parseParams,
  createBodyValidator,
  createQueryValidator,
  createParamsValidator,
  requireOneOf,
  requireAll,
  stripUndefined,
  isValidUUID,
  isValidDateTime,
  isValidCurrency,
  isValidCountryCode,
  type ValidationResult,
} from './validation.js';
