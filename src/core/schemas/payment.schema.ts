/**
 * Payment Validation Schemas
 * 
 * Zod schemas for payment-related requests.
 */

import { z } from 'zod';
import { AddressSchema } from './common.schema.js';

/**
 * Card number schema (basic validation)
 */
export const CardNumberSchema = z.string()
  .min(13, 'Card number too short')
  .max(19, 'Card number too long')
  .regex(/^[0-9]+$/, 'Card number must contain only digits');

/**
 * CVV schema
 */
export const CVVSchema = z.string()
  .min(3, 'CVV must be 3-4 digits')
  .max(4, 'CVV must be 3-4 digits')
  .regex(/^[0-9]+$/, 'CVV must contain only digits');

/**
 * Expiry month schema (1-12)
 */
export const ExpiryMonthSchema = z.string()
  .regex(/^(0?[1-9]|1[0-2])$/, 'Invalid expiry month');

/**
 * Expiry year schema (2 or 4 digits)
 */
export const ExpiryYearSchema = z.string()
  .regex(/^([0-9]{2}|[0-9]{4})$/, 'Invalid expiry year');

/**
 * Card payment method schema
 */
export const CardPaymentMethodSchema = z.object({
  type: z.literal('card'),
  /** Card number (PAN) */
  number: CardNumberSchema,
  /** Expiry month (1-12) */
  expiryMonth: ExpiryMonthSchema,
  /** Expiry year (2 or 4 digits) */
  expiryYear: ExpiryYearSchema,
  /** CVV/CVC */
  cvv: CVVSchema,
  /** Cardholder name */
  cardholderName: z.string().max(100).optional(),
});

/**
 * External token payment method schema
 */
export const ExternalTokenPaymentMethodSchema = z.object({
  type: z.literal('external_token'),
  /** Token from external provider */
  token: z.string().min(1, 'Token is required'),
  /** Provider name (e.g., "stripe", "google_pay") */
  provider: z.string().min(1, 'Provider is required'),
});

/**
 * Payment method schema (union)
 */
export const PaymentMethodSchema = z.discriminatedUnion('type', [
  CardPaymentMethodSchema,
  ExternalTokenPaymentMethodSchema,
]);

/**
 * Tokenize request schema
 */
export const TokenizeRequestSchema = z.object({
  /** Checkout session ID for token binding */
  checkoutId: z.string().min(1, 'Checkout ID is required'),
  /** Payment method to tokenize */
  paymentMethod: PaymentMethodSchema,
});

/**
 * Detokenize request schema
 */
export const DetokenizeRequestSchema = z.object({
  /** Checkout session ID */
  checkoutId: z.string().min(1, 'Checkout ID is required'),
  /** Token to detokenize */
  token: z.string().min(1, 'Token is required'),
});

/**
 * Payment instrument type enum
 */
export const InstrumentTypeSchema = z.enum(['card', 'wallet', 'bank', 'bnpl']);

/**
 * Credential type enum
 */
export const CredentialTypeSchema = z.enum(['token', 'encrypted', 'mandate']);

/**
 * Payment data schema (for checkout completion)
 */
export const PaymentDataSchema = z.object({
  /** Instrument ID */
  id: z.string().min(1, 'Instrument ID is required'),
  /** Handler ID */
  handlerId: z.string().min(1, 'Handler ID is required'),
  /** Payment credential */
  credential: z.object({
    type: CredentialTypeSchema,
    token: z.string().optional(),
    encryptedPayload: z.string().optional(),
    mandateId: z.string().optional(),
  }),
  /** Billing address */
  billingAddress: AddressSchema.optional(),
});

// Type exports
export type TokenizeInput = z.input<typeof TokenizeRequestSchema>;
export type DetokenizeInput = z.input<typeof DetokenizeRequestSchema>;
export type PaymentDataInput = z.input<typeof PaymentDataSchema>;
