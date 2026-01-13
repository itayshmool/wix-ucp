/**
 * Error Types
 * 
 * UCP-compliant error type definitions.
 */

/**
 * UCP standard error codes
 */
export type UCPErrorCode =
  | 'INVALID_REQUEST'      // Malformed request
  | 'INVALID_FIELD'        // Invalid field value
  | 'MISSING_FIELD'        // Required field missing
  | 'UNAUTHORIZED'         // Authentication required
  | 'FORBIDDEN'            // Permission denied
  | 'NOT_FOUND'            // Resource not found
  | 'CONFLICT'             // Resource conflict
  | 'GONE'                 // Resource no longer available
  | 'UNPROCESSABLE'        // Request understood but cannot process
  | 'RATE_LIMITED'         // Too many requests
  | 'INTERNAL_ERROR'       // Server error
  | 'SERVICE_UNAVAILABLE'; // Temporary unavailability

/**
 * HTTP status codes for UCP errors
 */
export const UCPErrorStatusMap: Record<UCPErrorCode, number> = {
  INVALID_REQUEST: 400,
  INVALID_FIELD: 400,
  MISSING_FIELD: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Error detail for field-level errors
 */
export interface ErrorDetail {
  /** Field path (e.g., "buyer.email") */
  field: string;
  /** Error code for this field */
  code: string;
  /** Human-readable error message */
  message: string;
}

/**
 * UCP error response body
 */
export interface UCPErrorBody {
  /** Error code */
  code: UCPErrorCode;
  /** Human-readable error message */
  message: string;
  /** Field-level error details (optional) */
  details?: ErrorDetail[];
  /** Whether the request can be retried */
  retryable?: boolean;
  /** Seconds to wait before retry (for rate limiting) */
  retryAfter?: number;
}

/**
 * Full UCP error response
 */
export interface UCPError {
  error: UCPErrorBody;
}

/**
 * Wix API error structure (for mapping)
 */
export interface WixAPIError {
  /** Wix error code */
  code?: string;
  /** Error message */
  message: string;
  /** HTTP status code */
  status?: number;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Custom error class for UCP errors
 */
export class UCPException extends Error {
  public readonly code: UCPErrorCode;
  public readonly statusCode: number;
  public readonly details?: ErrorDetail[];
  public readonly retryable: boolean;
  public readonly retryAfter?: number;

  constructor(
    code: UCPErrorCode,
    message: string,
    options?: {
      details?: ErrorDetail[];
      retryable?: boolean;
      retryAfter?: number;
    }
  ) {
    super(message);
    this.name = 'UCPException';
    this.code = code;
    this.statusCode = UCPErrorStatusMap[code];
    this.details = options?.details;
    this.retryable = options?.retryable ?? false;
    this.retryAfter = options?.retryAfter;
  }

  /**
   * Convert to UCP error response format
   */
  toResponse(): UCPError {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        retryable: this.retryable,
        retryAfter: this.retryAfter,
      },
    };
  }
}
