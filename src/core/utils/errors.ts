/**
 * Error Utility Functions
 * 
 * Factory functions for creating UCP-compliant errors.
 */

import type {
  UCPErrorCode,
  UCPError,
  ErrorDetail,
  WixAPIError,
} from '../types/index.js';
import { UCPException, UCPErrorStatusMap } from '../types/index.js';

/**
 * Create a UCP-compliant error response
 */
export function createUCPError(
  code: UCPErrorCode,
  message: string,
  options?: {
    details?: ErrorDetail[];
    retryable?: boolean;
    retryAfter?: number;
  }
): UCPError {
  return {
    error: {
      code,
      message,
      details: options?.details,
      retryable: options?.retryable ?? false,
      retryAfter: options?.retryAfter,
    },
  };
}

/**
 * Create a field validation error
 */
export function createFieldError(
  field: string,
  message: string,
  code: string = 'INVALID_VALUE'
): UCPError {
  return createUCPError('INVALID_FIELD', `Validation failed for field: ${field}`, {
    details: [{ field, code, message }],
  });
}

/**
 * Create a missing field error
 */
export function createMissingFieldError(field: string): UCPError {
  return createUCPError('MISSING_FIELD', `Required field missing: ${field}`, {
    details: [{ field, code: 'REQUIRED', message: `${field} is required` }],
  });
}

/**
 * Create a not found error
 */
export function createNotFoundError(resource: string, id?: string): UCPError {
  const message = id 
    ? `${resource} with ID '${id}' not found`
    : `${resource} not found`;
  return createUCPError('NOT_FOUND', message);
}

/**
 * Create a conflict error
 */
export function createConflictError(message: string): UCPError {
  return createUCPError('CONFLICT', message);
}

/**
 * Create a rate limit error
 */
export function createRateLimitError(retryAfter: number): UCPError {
  return createUCPError('RATE_LIMITED', 'Too many requests, please try again later', {
    retryable: true,
    retryAfter,
  });
}

/**
 * Create an internal error (sanitized for client)
 */
export function createInternalError(): UCPError {
  return createUCPError('INTERNAL_ERROR', 'An internal error occurred');
}

/**
 * Create an unauthorized error
 */
export function createUnauthorizedError(message: string = 'Authentication required'): UCPError {
  return createUCPError('UNAUTHORIZED', message);
}

/**
 * Create a forbidden error
 */
export function createForbiddenError(message: string = 'Permission denied'): UCPError {
  return createUCPError('FORBIDDEN', message);
}

/**
 * Map Wix API errors to UCP errors
 */
export function mapWixErrorToUCP(wixError: WixAPIError): UCPError {
  const { code, message, status } = wixError;

  // Map by Wix error code
  if (code) {
    switch (code) {
      case 'INVALID_ARGUMENT':
      case 'INVALID_REQUEST':
        return createUCPError('INVALID_REQUEST', message);

      case 'NOT_FOUND':
      case 'RESOURCE_NOT_FOUND':
        return createUCPError('NOT_FOUND', message);

      case 'ALREADY_EXISTS':
      case 'CONFLICT':
        return createUCPError('CONFLICT', message);

      case 'PERMISSION_DENIED':
      case 'FORBIDDEN':
        return createUCPError('FORBIDDEN', message);

      case 'UNAUTHENTICATED':
      case 'UNAUTHORIZED':
        return createUCPError('UNAUTHORIZED', message);

      case 'RESOURCE_EXHAUSTED':
      case 'RATE_LIMITED':
        return createUCPError('RATE_LIMITED', message, { retryable: true, retryAfter: 60 });

      case 'UNAVAILABLE':
      case 'SERVICE_UNAVAILABLE':
        return createUCPError('SERVICE_UNAVAILABLE', message, { retryable: true });

      default:
        // Fall through to status mapping
        break;
    }
  }

  // Map by HTTP status code
  if (status) {
    const statusMap: Record<number, UCPErrorCode> = {
      400: 'INVALID_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      410: 'GONE',
      422: 'UNPROCESSABLE',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_ERROR',
      502: 'SERVICE_UNAVAILABLE',
      503: 'SERVICE_UNAVAILABLE',
      504: 'SERVICE_UNAVAILABLE',
    };

    const ucpCode = statusMap[status] ?? 'INTERNAL_ERROR';
    return createUCPError(ucpCode, message, {
      retryable: status >= 500 || status === 429,
    });
  }

  // Default to internal error
  return createInternalError();
}

/**
 * Get HTTP status code for UCP error code
 */
export function getStatusForError(code: UCPErrorCode): number {
  return UCPErrorStatusMap[code];
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: UCPError | UCPException): boolean {
  if (error instanceof UCPException) {
    return error.retryable;
  }
  return error.error.retryable ?? false;
}

/**
 * Convert Zod validation errors to UCP error details
 */
export function zodErrorsToDetails(
  errors: Array<{ path: (string | number)[]; message: string }>
): ErrorDetail[] {
  return errors.map((err) => ({
    field: err.path.join('.'),
    code: 'INVALID_VALUE',
    message: err.message,
  }));
}

/**
 * Create UCP error from Zod validation result
 */
export function createValidationError(
  errors: Array<{ path: (string | number)[]; message: string }>
): UCPError {
  return createUCPError('INVALID_REQUEST', 'Request validation failed', {
    details: zodErrorsToDetails(errors),
  });
}
