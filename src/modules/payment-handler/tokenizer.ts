/**
 * Payment Tokenizer Service
 * 
 * Handles tokenization of payment credentials.
 * Binds tokens to specific checkout sessions and businesses.
 * 
 * See: .cursor/rules/modules/payment-handler.mdc
 */

import { randomUUID } from 'crypto';
import { logger } from '../../lib/logger.js';
import { storeToken, type StoredToken } from '../../lib/redis.js';
import { UCPException } from '../../core/types/errors.js';
import type {
  TokenizeRequestPayload,
  TokenizeResponsePayload,
  SourceCredential,
  StoredPaymentToken,
  CardNetwork,
  CardBrandInfo,
  WixPaymentsHandlerConfig,
} from './types.js';
import {
  CARD_BIN_PATTERNS,
  CARD_NETWORK_NAMES,
  TOKEN_TTL_SECONDS,
  isCardNetworkSupported,
  isPaymentMethodSupported,
} from './config.js';

/**
 * Tokenizer service for payment credentials
 */
export class PaymentTokenizer {
  private config: WixPaymentsHandlerConfig;

  constructor(config: WixPaymentsHandlerConfig) {
    this.config = config;
  }

  /**
   * Tokenize payment credentials
   * 
   * @param request - Tokenization request
   * @returns Tokenization response with opaque token
   */
  async tokenize(request: TokenizeRequestPayload): Promise<TokenizeResponsePayload> {
    const { sourceCredential, binding, metadata } = request;

    logger.info(
      { checkoutId: binding.checkoutId, type: sourceCredential.type },
      'Tokenizing payment credential'
    );

    // Validate payment method is supported
    this.validatePaymentMethod(sourceCredential);

    // Detect card brand (for card type)
    const brandInfo = sourceCredential.type === 'card'
      ? this.detectCardBrand(sourceCredential.pan!)
      : undefined;

    // Validate card network is supported
    if (brandInfo && !isCardNetworkSupported(brandInfo.brand, this.config)) {
      throw new UCPException(
        'INVALID_FIELD',
        `Card network ${brandInfo.brandName} is not supported`,
        { details: [{ field: 'sourceCredential.pan', code: 'UNSUPPORTED_CARD_NETWORK', message: `Card network ${brandInfo.brandName} is not supported` }] }
      );
    }

    // Generate opaque token
    const tokenId = this.generateTokenId();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString();

    // Build instrument details
    const instrument = this.buildInstrumentDetails(sourceCredential, brandInfo);

    // In a real implementation, this would call Wix Payments API
    // to get a Wix card token. For now, we generate a mock token.
    const wixCardToken = await this.createWixCardToken(sourceCredential);

    // Store token with binding
    const storedToken: StoredPaymentToken = {
      id: tokenId,
      wixCardToken,
      binding: {
        checkoutId: binding.checkoutId,
        businessId: binding.businessIdentity.value,
      },
      instrument,
      createdAt: new Date().toISOString(),
      expiresAt,
      used: false,
      credentialType: this.config.tokenizationType === 'PAYMENT_GATEWAY' ? 'network_token' : 'pan',
    };

    await this.storePaymentToken(binding.checkoutId, tokenId, storedToken);

    logger.info(
      { 
        tokenId, 
        checkoutId: binding.checkoutId,
        brand: instrument.brand,
        expiresAt,
      },
      'Payment credential tokenized successfully'
    );

    return {
      token: tokenId,
      expiresAt,
      instrument,
    };
  }

  /**
   * Validate payment method is supported
   */
  private validatePaymentMethod(credential: SourceCredential): void {
    const methodType = credential.type === 'card' ? 'creditCard' : credential.type;
    
    if (!isPaymentMethodSupported(methodType as 'creditCard' | 'googlePay' | 'applePay', this.config)) {
      throw new UCPException(
        'INVALID_FIELD',
        `Payment method ${credential.type} is not supported`,
        { details: [{ field: 'sourceCredential.type', code: 'UNSUPPORTED_PAYMENT_METHOD', message: `Payment method ${credential.type} is not supported` }] }
      );
    }

    // Validate required fields based on type
    if (credential.type === 'card') {
      if (!credential.pan || !credential.expiryMonth || !credential.expiryYear || !credential.cvv) {
        throw new UCPException(
          'MISSING_FIELD',
          'Card credentials require pan, expiryMonth, expiryYear, and cvv',
          { details: [{ field: 'sourceCredential', code: 'INVALID_CREDENTIALS', message: 'Card credentials require pan, expiryMonth, expiryYear, and cvv' }] }
        );
      }
    } else if (credential.type === 'googlePay' && !credential.googlePayToken) {
      throw new UCPException(
        'MISSING_FIELD',
        'Google Pay requires googlePayToken',
        { details: [{ field: 'sourceCredential.googlePayToken', code: 'MISSING_FIELD', message: 'Google Pay requires googlePayToken' }] }
      );
    } else if (credential.type === 'applePay' && !credential.applePayToken) {
      throw new UCPException(
        'MISSING_FIELD',
        'Apple Pay requires applePayToken',
        { details: [{ field: 'sourceCredential.applePayToken', code: 'MISSING_FIELD', message: 'Apple Pay requires applePayToken' }] }
      );
    }
  }

  /**
   * Detect card brand from PAN
   */
  detectCardBrand(pan: string): CardBrandInfo | undefined {
    const cleanPan = pan.replace(/\D/g, '');
    
    for (const [network, patterns] of Object.entries(CARD_BIN_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(cleanPan)) {
          return {
            brand: network as CardNetwork,
            brandName: CARD_NETWORK_NAMES[network as CardNetwork],
          };
        }
      }
    }

    return undefined;
  }

  /**
   * Build instrument details from credential
   */
  private buildInstrumentDetails(
    credential: SourceCredential,
    brandInfo?: CardBrandInfo
  ): TokenizeResponsePayload['instrument'] {
    if (credential.type === 'card') {
      return {
        type: 'card',
        brand: brandInfo?.brand,
        lastDigits: credential.pan!.slice(-4),
        expiryMonth: credential.expiryMonth,
        expiryYear: credential.expiryYear,
      };
    }

    // Wallet types (Google Pay, Apple Pay)
    return {
      type: 'wallet',
    };
  }

  /**
   * Generate a secure token ID
   */
  private generateTokenId(): string {
    return `tok_${randomUUID().replace(/-/g, '')}`;
  }

  /**
   * Create a Wix card token via Wix Payments API
   * 
   * In production, this would call:
   * POST /payments/v3/card-tokens
   * 
   * For now, returns a mock token.
   */
  private async createWixCardToken(credential: SourceCredential): Promise<string> {
    // TODO: Implement actual Wix Payments API call
    // This is a placeholder that would be replaced with real API integration
    
    // Simulate async operation
    await Promise.resolve();

    // Generate mock Wix token
    return `wix_tok_${randomUUID().replace(/-/g, '')}`;
  }

  /**
   * Store payment token in Redis
   */
  private async storePaymentToken(
    checkoutId: string,
    tokenId: string,
    token: StoredPaymentToken
  ): Promise<void> {
    // Map to the StoredToken interface used by Redis
    const storedToken: StoredToken = {
      id: token.id,
      wixCardToken: token.wixCardToken,
      binding: token.binding,
      instrument: token.instrument,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      used: token.used,
    };

    await storeToken(checkoutId, tokenId, storedToken);
  }
}

/**
 * Create a tokenizer instance with the given configuration
 */
export function createTokenizer(config: WixPaymentsHandlerConfig): PaymentTokenizer {
  return new PaymentTokenizer(config);
}
