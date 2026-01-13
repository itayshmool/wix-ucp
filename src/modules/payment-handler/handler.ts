/**
 * Payment Handler (com.wix.payments)
 * 
 * Main handler implementation that coordinates tokenization,
 * detokenization, and payment processing.
 * 
 * See: .cursor/rules/modules/payment-handler.mdc
 */

import { logger } from '../../lib/logger.js';
import type { PaymentHandler } from '../../core/types/payment.js';
import type {
  WixPaymentsHandlerConfig,
  TokenizeRequestPayload,
  TokenizeResponsePayload,
  DetokenizeRequestPayload,
  DetokenizeResponsePayload,
  PaymentHandlerError,
  PaymentHandlerErrorCode,
} from './types.js';
import { HANDLER_IDENTITY, getHandlerConfig, DEFAULT_HANDLER_CONFIG } from './config.js';
import { PaymentTokenizer, createTokenizer } from './tokenizer.js';
import { PaymentDetokenizer, createDetokenizer } from './detokenizer.js';

/**
 * Wix Payments Handler
 * 
 * Implements the UCP Payment Handler Provider interface for Wix Payments.
 */
export class WixPaymentsHandler {
  private config: WixPaymentsHandlerConfig;
  private tokenizer: PaymentTokenizer;
  private detokenizer: PaymentDetokenizer;

  constructor(merchantId: string, configOverrides?: Partial<WixPaymentsHandlerConfig>) {
    this.config = getHandlerConfig(merchantId, configOverrides);
    this.tokenizer = createTokenizer(this.config);
    this.detokenizer = createDetokenizer(this.config);

    logger.info(
      { 
        merchantId,
        environment: this.config.environment,
        supportedNetworks: this.config.supportedCardNetworks,
      },
      'WixPaymentsHandler initialized'
    );
  }

  /**
   * Get the handler declaration for UCP profile
   */
  getHandlerDeclaration(): PaymentHandler {
    return {
      id: `wix_pay_handler_${this.config.merchantId.slice(-6)}`,
      name: HANDLER_IDENTITY.name,
      version: HANDLER_IDENTITY.version,
      spec: HANDLER_IDENTITY.spec,
      configSchema: HANDLER_IDENTITY.configSchema,
      instrumentSchemas: [
        'https://dev.wix.com/ucp/payments/instruments/card.json',
      ],
      config: {
        merchantId: this.config.merchantId,
        environment: this.config.environment,
        supportedNetworks: this.config.supportedCardNetworks,
        supportedCurrencies: this.config.supportedCurrencies,
        supportsTokenization: true,
        supportsRecurring: this.config.recurringEnabled,
        threeDSEnabled: this.config.threeDSEnabled,
        tokenizationType: this.config.tokenizationType,
        gatewayMerchantId: this.config.gatewayMerchantId,
      },
    };
  }

  /**
   * Tokenize payment credentials
   * 
   * @param request - Tokenization request
   * @returns Tokenization response
   */
  async tokenize(request: TokenizeRequestPayload): Promise<TokenizeResponsePayload> {
    try {
      return await this.tokenizer.tokenize(request);
    } catch (error) {
      // Re-throw UCPException as-is
      if (error instanceof Error && error.name === 'UCPException') {
        throw error;
      }

      logger.error(
        { error, checkoutId: request.binding.checkoutId },
        'Tokenization failed'
      );

      // Wrap unknown errors
      throw this.createHandlerError(
        'NETWORK_ERROR',
        'Failed to tokenize payment credentials',
        false
      );
    }
  }

  /**
   * Detokenize a payment token
   * 
   * @param request - Detokenization request
   * @returns Detokenization response
   */
  async detokenize(request: DetokenizeRequestPayload): Promise<DetokenizeResponsePayload> {
    try {
      return await this.detokenizer.detokenize(request);
    } catch (error) {
      // Re-throw UCPException as-is
      if (error instanceof Error && error.name === 'UCPException') {
        throw error;
      }

      logger.error(
        { error, checkoutId: request.binding.checkoutId },
        'Detokenization failed'
      );

      // Wrap unknown errors
      throw this.createHandlerError(
        'NETWORK_ERROR',
        'Failed to detokenize payment token',
        false
      );
    }
  }

  /**
   * Invalidate a payment token
   * 
   * @param checkoutId - Checkout session ID
   * @param token - Token to invalidate
   * @returns True if token was invalidated
   */
  async invalidateToken(checkoutId: string, token: string): Promise<boolean> {
    return this.detokenizer.invalidateToken(checkoutId, token);
  }

  /**
   * Get handler configuration
   */
  getConfig(): Readonly<WixPaymentsHandlerConfig> {
    return { ...this.config };
  }

  /**
   * Create a handler-specific error
   */
  private createHandlerError(
    code: PaymentHandlerErrorCode,
    message: string,
    retryable: boolean,
    declineCode?: string,
    requiresAction?: PaymentHandlerError['error']['requiresAction']
  ): PaymentHandlerError {
    return {
      error: {
        code,
        message,
        retryable,
        declineCode,
        requiresAction,
      },
    };
  }
}

/**
 * Create a new WixPaymentsHandler instance
 */
export function createWixPaymentsHandler(
  merchantId: string,
  configOverrides?: Partial<WixPaymentsHandlerConfig>
): WixPaymentsHandler {
  return new WixPaymentsHandler(merchantId, configOverrides);
}

/**
 * Default handler instance factory
 * Uses environment variables for configuration
 */
export function createDefaultHandler(): WixPaymentsHandler {
  const merchantId = process.env.WIX_ACCOUNT_ID || 'default_merchant';
  return createWixPaymentsHandler(merchantId);
}
