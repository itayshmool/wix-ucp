/**
 * Payment Handler Configuration
 * 
 * Configuration for com.wix.payments handler.
 * See: .cursor/rules/modules/payment-handler.mdc
 */

import type { WixPaymentsHandlerConfig, CardNetwork, PaymentMethodType } from './types.js';

/**
 * Handler identity constants
 */
export const HANDLER_IDENTITY = {
  name: 'com.wix.payments',
  version: '2026-01-11',
  spec: 'https://dev.wix.com/ucp/payments/spec',
  configSchema: 'https://dev.wix.com/ucp/payments/config.json',
} as const;

/**
 * Default handler configuration
 */
export const DEFAULT_HANDLER_CONFIG: Omit<WixPaymentsHandlerConfig, 'merchantId' | 'gatewayMerchantId'> = {
  environment: (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production',
  supportedCardNetworks: ['VISA', 'MASTERCARD', 'AMEX', 'DISCOVER'],
  supportedPaymentMethods: ['creditCard', 'googlePay', 'applePay'],
  supportedCurrencies: ['USD', 'EUR', 'GBP', 'ILS'],
  threeDSEnabled: true,
  recurringEnabled: true,
  tokenizationType: 'PAYMENT_GATEWAY',
};

/**
 * Token TTL in seconds (15 minutes as per spec)
 */
export const TOKEN_TTL_SECONDS = 15 * 60;

/**
 * Card network BIN ranges for detection
 * First 6 digits (IIN/BIN) determine the network
 */
export const CARD_BIN_PATTERNS: Record<CardNetwork, RegExp[]> = {
  VISA: [/^4/],
  MASTERCARD: [/^5[1-5]/, /^2[2-7]/],
  AMEX: [/^3[47]/],
  DISCOVER: [/^6(?:011|5)/],
};

/**
 * Card network display names
 */
export const CARD_NETWORK_NAMES: Record<CardNetwork, string> = {
  VISA: 'Visa',
  MASTERCARD: 'Mastercard',
  AMEX: 'American Express',
  DISCOVER: 'Discover',
};

/**
 * Get handler configuration with merchant-specific values
 */
export function getHandlerConfig(
  merchantId: string,
  overrides?: Partial<WixPaymentsHandlerConfig>
): WixPaymentsHandlerConfig {
  return {
    ...DEFAULT_HANDLER_CONFIG,
    merchantId,
    ...overrides,
  };
}

/**
 * Check if a card network is supported
 */
export function isCardNetworkSupported(
  network: CardNetwork,
  config: WixPaymentsHandlerConfig = { ...DEFAULT_HANDLER_CONFIG, merchantId: '' }
): boolean {
  return config.supportedCardNetworks.includes(network);
}

/**
 * Check if a payment method is supported
 */
export function isPaymentMethodSupported(
  method: PaymentMethodType,
  config: WixPaymentsHandlerConfig = { ...DEFAULT_HANDLER_CONFIG, merchantId: '' }
): boolean {
  return config.supportedPaymentMethods.includes(method);
}

/**
 * Check if a currency is supported
 */
export function isCurrencySupported(
  currency: string,
  config: WixPaymentsHandlerConfig = { ...DEFAULT_HANDLER_CONFIG, merchantId: '' }
): boolean {
  return config.supportedCurrencies.includes(currency.toUpperCase());
}
