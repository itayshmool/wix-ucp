/**
 * Wix API Base Client
 * 
 * HTTP client for Wix Platform APIs.
 * Handles authentication, retries, and error mapping.
 */

import { logger } from '../../lib/logger.js';
import type { WixApiError } from './types.js';

/**
 * Wix API client configuration
 */
export interface WixClientConfig {
  /** Wix API key */
  apiKey: string;
  /** Wix account ID */
  accountId: string;
  /** Wix site ID */
  siteId: string;
  /** Base URL (defaults to production) */
  baseUrl?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Number of retries for failed requests */
  retries?: number;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  baseUrl: 'https://www.wixapis.com',
  timeout: 30000,
  retries: 3,
} as const;

/**
 * HTTP methods
 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Request options
 */
interface RequestOptions {
  method: HttpMethod;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Wix API client error
 */
export class WixClientError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly retryable: boolean;

  constructor(
    message: string,
    statusCode: number,
    code?: string,
    retryable = false
  ) {
    super(message);
    this.name = 'WixClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * Base Wix API client
 */
export class WixClient {
  private config: Required<WixClientConfig>;

  constructor(config: WixClientConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    logger.debug(
      { accountId: this.config.accountId, siteId: this.config.siteId },
      'WixClient initialized'
    );
  }

  /**
   * Make an authenticated request to Wix API
   */
  async request<T>(options: RequestOptions): Promise<T> {
    const { method, path, body, headers = {}, timeout = this.config.timeout } = options;
    const url = `${this.config.baseUrl}${path}`;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': this.config.apiKey,
      'wix-account-id': this.config.accountId,
      'wix-site-id': this.config.siteId,
      ...headers,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({})) as WixApiError;
          const errorMessage = errorBody.message || `HTTP ${response.status}`;
          const errorCode = errorBody.details?.applicationError?.code;

          // Determine if retryable
          const retryable = response.status >= 500 || response.status === 429;

          if (retryable && attempt < this.config.retries) {
            logger.warn(
              { attempt, status: response.status, path },
              'Wix API request failed, retrying'
            );
            await this.delay(this.getRetryDelay(attempt));
            continue;
          }

          throw new WixClientError(
            errorMessage,
            response.status,
            errorCode,
            retryable
          );
        }

        const data = await response.json() as T;
        return data;
      } catch (error) {
        if (error instanceof WixClientError) {
          throw error;
        }

        lastError = error as Error;

        if ((error as Error).name === 'AbortError') {
          throw new WixClientError(
            'Request timeout',
            408,
            'TIMEOUT',
            true
          );
        }

        // Network error - retry
        if (attempt < this.config.retries) {
          logger.warn(
            { attempt, error: (error as Error).message, path },
            'Wix API request failed, retrying'
          );
          await this.delay(this.getRetryDelay(attempt));
          continue;
        }
      }
    }

    throw new WixClientError(
      lastError?.message || 'Request failed after retries',
      500,
      'NETWORK_ERROR',
      true
    );
  }

  /**
   * GET request
   */
  async get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: 'GET', path, headers });
  }

  /**
   * POST request
   */
  async post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: 'POST', path, body, headers });
  }

  /**
   * PUT request
   */
  async put<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: 'PUT', path, body, headers });
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>({ method: 'DELETE', path, headers });
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private getRetryDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 10000);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a Wix client from environment variables
 */
export function createWixClient(): WixClient | null {
  const apiKey = process.env.WIX_API_KEY;
  const accountId = process.env.WIX_ACCOUNT_ID;
  const siteId = process.env.WIX_SITE_ID;

  if (!apiKey || !accountId || !siteId) {
    logger.warn('Wix API credentials not configured');
    return null;
  }

  return new WixClient({
    apiKey,
    accountId,
    siteId,
  });
}
