/**
 * Payment Handler Module Types
 * 
 * Module-specific types for com.wix.payments handler.
 * See: .cursor/rules/modules/payment-handler.mdc
 */

/**
 * Wix Payments handler configuration
 */
export interface WixPaymentsHandlerConfig {
  /** Wix merchant ID */
  merchantId: string;
  /** Environment */
  environment: 'sandbox' | 'production';
  /** Supported card networks */
  supportedCardNetworks: CardNetwork[];
  /** Supported payment methods */
  supportedPaymentMethods: PaymentMethodType[];
  /** Supported currencies (ISO 4217) */
  supportedCurrencies: string[];
  /** Whether 3D Secure is enabled */
  threeDSEnabled: boolean;
  /** Whether recurring payments are enabled */
  recurringEnabled: boolean;
  /** Tokenization type */
  tokenizationType: 'PAYMENT_GATEWAY' | 'DIRECT';
  /** Gateway merchant ID (for Google Pay gateway tokenization) */
  gatewayMerchantId?: string;
}

/**
 * Supported card networks
 */
export type CardNetwork = 'VISA' | 'MASTERCARD' | 'AMEX' | 'DISCOVER';

/**
 * Supported payment method types
 */
export type PaymentMethodType = 'creditCard' | 'googlePay' | 'applePay' | 'payPal';

/**
 * Source credential for tokenization
 */
export interface SourceCredential {
  type: 'card' | 'googlePay' | 'applePay';
  /** Card PAN (for card type) */
  pan?: string;
  /** Expiry month (for card type) */
  expiryMonth?: string;
  /** Expiry year (for card type) */
  expiryYear?: string;
  /** CVV (for card type) */
  cvv?: string;
  /** Cardholder name (optional) */
  cardholderName?: string;
  /** Google Pay token (for googlePay type) */
  googlePayToken?: string;
  /** Apple Pay token (for applePay type) */
  applePayToken?: string;
}

/**
 * Business identity for token binding
 */
export interface BusinessIdentity {
  type: 'wix_merchant_id';
  value: string;
}

/**
 * Token binding context
 */
export interface TokenBinding {
  /** Checkout session ID */
  checkoutId: string;
  /** Business identity */
  businessIdentity: BusinessIdentity;
}

/**
 * Tokenize request payload
 */
export interface TokenizeRequestPayload {
  /** Source credential to tokenize */
  sourceCredential: SourceCredential;
  /** Binding context */
  binding: TokenBinding;
  /** Optional metadata */
  metadata?: Record<string, string>;
}

/**
 * Tokenize response
 */
export interface TokenizeResponsePayload {
  /** Opaque token */
  token: string;
  /** Token expiration (ISO 8601) */
  expiresAt: string;
  /** Instrument details */
  instrument: {
    type: 'card' | 'wallet';
    brand?: string;
    lastDigits?: string;
    expiryMonth?: string;
    expiryYear?: string;
  };
}

/**
 * Detokenize request payload
 */
export interface DetokenizeRequestPayload {
  /** Token to detokenize */
  token: string;
  /** Binding context (must match original binding) */
  binding: TokenBinding;
  /** PSP delegation (optional) */
  delegatedTo?: {
    type: 'psp';
    identity: string;
  };
}

/**
 * Detokenize response
 */
export interface DetokenizeResponsePayload {
  /** Credential data */
  credential: {
    type: 'network_token' | 'pan';
    /** Network token (preferred) */
    networkToken?: string;
    /** Cryptogram */
    cryptogram?: string;
    /** ECI indicator */
    eci?: string;
    /** Raw PAN (only for DIRECT tokenization) */
    pan?: string;
    /** Expiry month */
    expiryMonth?: string;
    /** Expiry year */
    expiryYear?: string;
  };
  /** Whether token was invalidated (single-use) */
  invalidated: boolean;
}

/**
 * Payment handler error codes
 */
export type PaymentHandlerErrorCode =
  | 'CARD_DECLINED'
  | 'INSUFFICIENT_FUNDS'
  | 'EXPIRED_CARD'
  | 'INVALID_CVV'
  | '3DS_REQUIRED'
  | '3DS_FAILED'
  | 'NETWORK_ERROR'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'BINDING_MISMATCH'
  | 'UNSUPPORTED_CARD_NETWORK'
  | 'UNSUPPORTED_PAYMENT_METHOD'
  | 'INVALID_CREDENTIALS';

/**
 * Payment handler error response
 */
export interface PaymentHandlerError {
  error: {
    code: PaymentHandlerErrorCode;
    message: string;
    /** Network-specific decline code */
    declineCode?: string;
    /** Whether the error is retryable */
    retryable: boolean;
    /** Required action (e.g., 3DS authentication) */
    requiresAction?: {
      type: '3ds_authentication';
      redirectUrl: string;
    };
  };
}

/**
 * Stored token structure (for Redis)
 */
export interface StoredPaymentToken {
  /** Token ID */
  id: string;
  /** Wix card token from Wix Payments API */
  wixCardToken: string;
  /** Token binding */
  binding: {
    checkoutId: string;
    businessId: string;
  };
  /** Instrument details */
  instrument: {
    type: 'card' | 'wallet';
    brand?: string;
    lastDigits?: string;
    expiryMonth?: string;
    expiryYear?: string;
  };
  /** Creation timestamp */
  createdAt: string;
  /** Expiration timestamp */
  expiresAt: string;
  /** Whether token has been used (single-use enforcement) */
  used: boolean;
  /** Original credential type for detokenization */
  credentialType: 'network_token' | 'pan';
}

/**
 * Card brand detection result
 */
export interface CardBrandInfo {
  brand: CardNetwork;
  brandName: string;
}
