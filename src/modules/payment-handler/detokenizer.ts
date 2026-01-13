/**
 * Payment Detokenizer Service
 * 
 * Handles detokenization of payment tokens.
 * Enforces single-use and binding verification.
 * 
 * See: .cursor/rules/modules/payment-handler.mdc
 */

import { logger } from '../../lib/logger.js';
import { getToken, markTokenUsed, deleteToken, type StoredToken } from '../../lib/redis.js';
import { UCPException } from '../../core/types/errors.js';
import type {
  DetokenizeRequestPayload,
  DetokenizeResponsePayload,
  StoredPaymentToken,
  WixPaymentsHandlerConfig,
} from './types.js';

/**
 * Detokenizer service for payment tokens
 */
export class PaymentDetokenizer {
  private config: WixPaymentsHandlerConfig;

  constructor(config: WixPaymentsHandlerConfig) {
    this.config = config;
  }

  /**
   * Detokenize a payment token
   * 
   * @param request - Detokenization request
   * @returns Detokenization response with credential data
   * @throws UCPException for invalid, expired, or mismatched tokens
   */
  async detokenize(request: DetokenizeRequestPayload): Promise<DetokenizeResponsePayload> {
    const { token, binding, delegatedTo } = request;

    logger.info(
      { 
        tokenId: token, 
        checkoutId: binding.checkoutId,
        delegatedTo: delegatedTo?.identity,
      },
      'Detokenizing payment token'
    );

    // Retrieve token from storage
    const storedToken = await this.getStoredToken(binding.checkoutId, token);

    // Validate token exists
    if (!storedToken) {
      throw new UCPException(
        'NOT_FOUND',
        'Payment token not found or expired',
        { details: [{ field: 'token', code: 'TOKEN_NOT_FOUND', message: 'Payment token not found or expired' }] }
      );
    }

    // Validate token hasn't been used (single-use enforcement)
    if (storedToken.used) {
      logger.warn(
        { tokenId: token, checkoutId: binding.checkoutId },
        'Attempted to reuse payment token'
      );
      throw new UCPException(
        'GONE',
        'Payment token has already been used',
        { details: [{ field: 'token', code: 'TOKEN_INVALID', message: 'Payment token has already been used' }] }
      );
    }

    // Validate token hasn't expired
    if (new Date(storedToken.expiresAt) < new Date()) {
      logger.warn(
        { tokenId: token, expiresAt: storedToken.expiresAt },
        'Attempted to use expired payment token'
      );
      throw new UCPException(
        'GONE',
        'Payment token has expired',
        { details: [{ field: 'token', code: 'TOKEN_EXPIRED', message: 'Payment token has expired' }] }
      );
    }

    // Validate binding matches
    this.validateBinding(storedToken, binding);

    // Mark token as used (single-use)
    const marked = await markTokenUsed(binding.checkoutId, token);
    if (!marked) {
      // Race condition - token was used by another request
      throw new UCPException(
        'CONFLICT',
        'Payment token is no longer available',
        { details: [{ field: 'token', code: 'TOKEN_INVALID', message: 'Payment token is no longer available' }] }
      );
    }

    // Build credential response
    const credential = await this.buildCredentialResponse(storedToken, delegatedTo);

    logger.info(
      { 
        tokenId: token, 
        checkoutId: binding.checkoutId,
        credentialType: credential.type,
      },
      'Payment token detokenized successfully'
    );

    return {
      credential,
      invalidated: true,
    };
  }

  /**
   * Validate that the binding matches the stored token
   */
  private validateBinding(
    storedToken: StoredToken,
    binding: DetokenizeRequestPayload['binding']
  ): void {
    // Check checkout ID
    if (storedToken.binding.checkoutId !== binding.checkoutId) {
      logger.warn(
        { 
          expected: storedToken.binding.checkoutId,
          received: binding.checkoutId,
        },
        'Checkout ID binding mismatch'
      );
      throw new UCPException(
        'FORBIDDEN',
        'Token binding mismatch: checkoutId does not match',
        { details: [{ field: 'binding.checkoutId', code: 'BINDING_MISMATCH', message: 'Token binding mismatch: checkoutId does not match' }] }
      );
    }

    // Check business ID
    if (storedToken.binding.businessId !== binding.businessIdentity.value) {
      logger.warn(
        { 
          expected: storedToken.binding.businessId,
          received: binding.businessIdentity.value,
        },
        'Business ID binding mismatch'
      );
      throw new UCPException(
        'FORBIDDEN',
        'Token binding mismatch: businessIdentity does not match',
        { details: [{ field: 'binding.businessIdentity', code: 'BINDING_MISMATCH', message: 'Token binding mismatch: businessIdentity does not match' }] }
      );
    }
  }

  /**
   * Build the credential response based on tokenization type
   */
  private async buildCredentialResponse(
    storedToken: StoredToken,
    delegatedTo?: DetokenizeRequestPayload['delegatedTo']
  ): Promise<DetokenizeResponsePayload['credential']> {
    // In production, this would call Wix Payments API to get the actual credential
    // The response type depends on the tokenization type configured

    if (this.config.tokenizationType === 'PAYMENT_GATEWAY') {
      // Return network token (preferred, more secure)
      const networkToken = await this.fetchNetworkToken(storedToken.wixCardToken);
      
      return {
        type: 'network_token',
        networkToken: networkToken.token,
        cryptogram: networkToken.cryptogram,
        eci: networkToken.eci,
        expiryMonth: storedToken.instrument.expiryMonth,
        expiryYear: storedToken.instrument.expiryYear,
      };
    } else {
      // DIRECT tokenization - return raw PAN (less secure, only when necessary)
      const panData = await this.fetchPanData(storedToken.wixCardToken);
      
      return {
        type: 'pan',
        pan: panData.pan,
        expiryMonth: storedToken.instrument.expiryMonth,
        expiryYear: storedToken.instrument.expiryYear,
      };
    }
  }

  /**
   * Fetch network token from Wix Payments API
   * 
   * In production, this would call the actual API.
   * Returns mock data for now.
   */
  private async fetchNetworkToken(
    wixCardToken: string
  ): Promise<{ token: string; cryptogram: string; eci: string }> {
    // TODO: Implement actual Wix Payments API call
    await Promise.resolve();

    // Mock network token response
    return {
      token: `ntok_${wixCardToken.slice(-12)}`,
      cryptogram: 'AJkBByECCAAAAAAAAAAAACAgIIAAAA==',
      eci: '05',
    };
  }

  /**
   * Fetch PAN data from Wix Payments API (DIRECT mode only)
   * 
   * In production, this would call the actual API.
   * Returns mock data for now.
   */
  private async fetchPanData(wixCardToken: string): Promise<{ pan: string }> {
    // TODO: Implement actual Wix Payments API call
    await Promise.resolve();

    // Mock PAN response (never return real PAN in logs/tests!)
    return {
      pan: '4111111111111111',
    };
  }

  /**
   * Get stored token from Redis
   */
  private async getStoredToken(
    checkoutId: string,
    tokenId: string
  ): Promise<StoredToken | null> {
    return getToken(checkoutId, tokenId);
  }

  /**
   * Invalidate a token (delete from storage)
   */
  async invalidateToken(checkoutId: string, tokenId: string): Promise<boolean> {
    logger.info(
      { tokenId, checkoutId },
      'Invalidating payment token'
    );

    return deleteToken(checkoutId, tokenId);
  }
}

/**
 * Create a detokenizer instance with the given configuration
 */
export function createDetokenizer(config: WixPaymentsHandlerConfig): PaymentDetokenizer {
  return new PaymentDetokenizer(config);
}
