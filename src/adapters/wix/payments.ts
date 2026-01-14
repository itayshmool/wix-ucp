/**
 * Wix Payments API Client
 * 
 * Client for Wix Payments API operations.
 * Handles card tokenization, transactions, and refunds.
 */

import { logger } from '../../lib/logger.js';
import { WixClient, WixClientError, createWixClient, isDemoMode } from './client.js';
import type {
  WixCreateCardTokenRequest,
  WixCardTokenResponse,
  WixCreateTransactionRequest,
  WixTransactionResponse,
  WixRefundRequest,
  WixRefundResponse,
} from './types.js';

/**
 * API paths for Wix Payments
 */
const API_PATHS = {
  cardTokens: '/payments/v3/card-tokens',
  transactions: '/payments/v3/transactions',
  transaction: (id: string) => `/payments/v3/transactions/${id}`,
  capture: (id: string) => `/payments/v3/transactions/${id}/capture`,
  void: (id: string) => `/payments/v3/transactions/${id}/void`,
  refund: (id: string) => `/payments/v3/transactions/${id}/refund`,
} as const;

/**
 * Wix Payments API client
 */
export class WixPaymentsClient {
  private client: WixClient | null;
  private mockMode: boolean;

  constructor(client?: WixClient | null, forceMockMode = false) {
    // Use DEMO_MODE environment variable to control mock mode
    // Can be overridden by forceMockMode for testing
    if (forceMockMode || isDemoMode()) {
      this.client = null;
      this.mockMode = true;
      logger.info('WixPaymentsClient initialized in DEMO mode (mock data)');
    } else {
      this.client = client === undefined ? createWixClient() : client;
      this.mockMode = !this.client;
      
      if (this.mockMode) {
        logger.warn('Wix credentials missing - falling back to DEMO mode');
      } else {
        logger.info('WixPaymentsClient initialized in LIVE mode (real Wix APIs)');
      }
    }
  }

  /**
   * Check if client is in mock mode
   */
  isMockMode(): boolean {
    return this.mockMode;
  }

  /**
   * Tokenize a card
   * 
   * Creates a single-use card token from card details.
   */
  async createCardToken(request: WixCreateCardTokenRequest): Promise<WixCardTokenResponse> {
    logger.info('Creating card token');

    if (this.mockMode) {
      return this.mockCreateCardToken(request);
    }

    try {
      const response = await this.client!.post<WixCardTokenResponse>(
        API_PATHS.cardTokens,
        {
          cardNumber: request.cardNumber,
          expirationMonth: request.expiryMonth,
          expirationYear: request.expiryYear,
          cvv: request.cvv,
          holderName: request.cardholderName,
          billingAddress: request.billingAddress,
        }
      );

      return response;
    } catch (error) {
      logger.error({ error }, 'Failed to create card token');
      throw error;
    }
  }

  /**
   * Create a payment transaction
   */
  async createTransaction(request: WixCreateTransactionRequest): Promise<WixTransactionResponse> {
    logger.info({ amount: request.amount, currency: request.currency }, 'Creating transaction');

    if (this.mockMode) {
      return this.mockCreateTransaction(request);
    }

    try {
      const response = await this.client!.post<WixTransactionResponse>(
        API_PATHS.transactions,
        {
          amount: request.amount,
          currency: request.currency,
          cardToken: request.cardToken,
          orderReference: request.orderReference,
          description: request.description,
          threeDSecure: request.threeDSecure,
          captureNow: request.captureNow,
        }
      );

      return response;
    } catch (error) {
      logger.error({ error }, 'Failed to create transaction');
      throw error;
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(transactionId: string): Promise<WixTransactionResponse> {
    logger.info({ transactionId }, 'Getting transaction');

    if (this.mockMode) {
      return this.mockGetTransaction(transactionId);
    }

    try {
      const response = await this.client!.get<WixTransactionResponse>(
        API_PATHS.transaction(transactionId)
      );

      return response;
    } catch (error) {
      logger.error({ error, transactionId }, 'Failed to get transaction');
      throw error;
    }
  }

  /**
   * Capture an authorized transaction
   */
  async captureTransaction(transactionId: string, amount?: number): Promise<WixTransactionResponse> {
    logger.info({ transactionId, amount }, 'Capturing transaction');

    if (this.mockMode) {
      return this.mockCaptureTransaction(transactionId);
    }

    try {
      const response = await this.client!.post<WixTransactionResponse>(
        API_PATHS.capture(transactionId),
        amount ? { amount } : undefined
      );

      return response;
    } catch (error) {
      logger.error({ error, transactionId }, 'Failed to capture transaction');
      throw error;
    }
  }

  /**
   * Void an authorized transaction
   */
  async voidTransaction(transactionId: string): Promise<WixTransactionResponse> {
    logger.info({ transactionId }, 'Voiding transaction');

    if (this.mockMode) {
      return this.mockVoidTransaction(transactionId);
    }

    try {
      const response = await this.client!.post<WixTransactionResponse>(
        API_PATHS.void(transactionId)
      );

      return response;
    } catch (error) {
      logger.error({ error, transactionId }, 'Failed to void transaction');
      throw error;
    }
  }

  /**
   * Refund a captured transaction
   */
  async refundTransaction(transactionId: string, request: WixRefundRequest): Promise<WixRefundResponse> {
    logger.info({ transactionId, amount: request.amount }, 'Refunding transaction');

    if (this.mockMode) {
      return this.mockRefundTransaction(transactionId, request);
    }

    try {
      const response = await this.client!.post<WixRefundResponse>(
        API_PATHS.refund(transactionId),
        {
          amount: request.amount,
          reason: request.reason,
        }
      );

      return response;
    } catch (error) {
      logger.error({ error, transactionId }, 'Failed to refund transaction');
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Mock Implementations (for development/testing)
  // ─────────────────────────────────────────────────────────────

  private mockCreateCardToken(request: WixCreateCardTokenRequest): WixCardTokenResponse {
    const lastFour = request.cardNumber.slice(-4);
    const brand = this.detectCardBrand(request.cardNumber);

    return {
      cardToken: `wix_tok_mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      cardBrand: brand,
      lastFourDigits: lastFour,
      expiryMonth: request.expiryMonth,
      expiryYear: request.expiryYear,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  private mockCreateTransaction(request: WixCreateTransactionRequest): WixTransactionResponse {
    return {
      id: `txn_mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      status: request.captureNow ? 'CAPTURED' : 'APPROVED',
      amount: request.amount,
      currency: request.currency,
      authorizationCode: `AUTH${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    };
  }

  private mockGetTransaction(transactionId: string): WixTransactionResponse {
    return {
      id: transactionId,
      status: 'CAPTURED',
      amount: 1000,
      currency: 'USD',
      authorizationCode: 'AUTH123456',
      createdAt: new Date().toISOString(),
    };
  }

  private mockCaptureTransaction(transactionId: string): WixTransactionResponse {
    return {
      id: transactionId,
      status: 'CAPTURED',
      amount: 1000,
      currency: 'USD',
      authorizationCode: 'AUTH123456',
      createdAt: new Date().toISOString(),
    };
  }

  private mockVoidTransaction(transactionId: string): WixTransactionResponse {
    return {
      id: transactionId,
      status: 'VOIDED',
      amount: 1000,
      currency: 'USD',
      createdAt: new Date().toISOString(),
    };
  }

  private mockRefundTransaction(transactionId: string, request: WixRefundRequest): WixRefundResponse {
    return {
      id: `ref_mock_${Date.now()}`,
      transactionId,
      status: 'COMPLETED',
      amount: request.amount,
      currency: 'USD',
      createdAt: new Date().toISOString(),
    };
  }

  private detectCardBrand(cardNumber: string): string {
    const clean = cardNumber.replace(/\D/g, '');
    if (/^4/.test(clean)) return 'VISA';
    if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return 'MASTERCARD';
    if (/^3[47]/.test(clean)) return 'AMEX';
    if (/^6(?:011|5)/.test(clean)) return 'DISCOVER';
    return 'UNKNOWN';
  }
}

/**
 * Create a Wix Payments client
 */
export function createWixPaymentsClient(client?: WixClient | null, forceMockMode = false): WixPaymentsClient {
  return new WixPaymentsClient(client, forceMockMode);
}

/**
 * Create a mock Wix Payments client (for testing)
 */
export function createMockWixPaymentsClient(): WixPaymentsClient {
  return new WixPaymentsClient(null, true);
}
