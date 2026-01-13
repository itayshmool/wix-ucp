/**
 * Payment Handler API Schemas
 * 
 * Zod schemas for payment handler API requests/responses.
 * See: .cursor/rules/modules/payment-handler.mdc
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// Common Schemas
// ─────────────────────────────────────────────────────────────

/**
 * Business identity schema
 */
export const BusinessIdentitySchema = z.object({
  type: z.literal('wix_merchant_id'),
  value: z.string().min(1, 'Business identity value is required'),
});

/**
 * Token binding schema
 */
export const TokenBindingSchema = z.object({
  checkoutId: z.string().min(1, 'Checkout ID is required'),
  businessIdentity: BusinessIdentitySchema,
});

// ─────────────────────────────────────────────────────────────
// Tokenize Request/Response
// ─────────────────────────────────────────────────────────────

/**
 * Card credential schema
 */
export const CardCredentialSchema = z.object({
  type: z.literal('card'),
  pan: z.string()
    .min(13, 'Card number too short')
    .max(19, 'Card number too long')
    .regex(/^[0-9]+$/, 'Card number must contain only digits'),
  expiryMonth: z.string()
    .regex(/^(0?[1-9]|1[0-2])$/, 'Invalid expiry month (1-12)'),
  expiryYear: z.string()
    .regex(/^([0-9]{2}|[0-9]{4})$/, 'Invalid expiry year (YY or YYYY)'),
  cvv: z.string()
    .min(3, 'CVV must be 3-4 digits')
    .max(4, 'CVV must be 3-4 digits')
    .regex(/^[0-9]+$/, 'CVV must contain only digits'),
  cardholderName: z.string().max(100).optional(),
});

/**
 * Google Pay credential schema
 */
export const GooglePayCredentialSchema = z.object({
  type: z.literal('googlePay'),
  googlePayToken: z.string().min(1, 'Google Pay token is required'),
});

/**
 * Apple Pay credential schema
 */
export const ApplePayCredentialSchema = z.object({
  type: z.literal('applePay'),
  applePayToken: z.string().min(1, 'Apple Pay token is required'),
});

/**
 * Source credential schema (union)
 */
export const SourceCredentialSchema = z.discriminatedUnion('type', [
  CardCredentialSchema,
  GooglePayCredentialSchema,
  ApplePayCredentialSchema,
]);

/**
 * Tokenize request schema
 */
export const TokenizeRequestSchema = z.object({
  sourceCredential: SourceCredentialSchema,
  binding: TokenBindingSchema,
  metadata: z.record(z.string()).optional(),
});

/**
 * Tokenize response schema
 */
export const TokenizeResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string().datetime(),
  instrument: z.object({
    type: z.enum(['card', 'wallet']),
    brand: z.string().optional(),
    lastDigits: z.string().optional(),
    expiryMonth: z.string().optional(),
    expiryYear: z.string().optional(),
  }),
});

// ─────────────────────────────────────────────────────────────
// Detokenize Request/Response
// ─────────────────────────────────────────────────────────────

/**
 * PSP delegation schema
 */
export const PSPDelegationSchema = z.object({
  type: z.literal('psp'),
  identity: z.string().min(1, 'PSP identity is required'),
});

/**
 * Detokenize request schema
 */
export const DetokenizeRequestSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  binding: TokenBindingSchema,
  delegatedTo: PSPDelegationSchema.optional(),
});

/**
 * Detokenize response schema
 */
export const DetokenizeResponseSchema = z.object({
  credential: z.object({
    type: z.enum(['network_token', 'pan']),
    networkToken: z.string().optional(),
    cryptogram: z.string().optional(),
    eci: z.string().optional(),
    pan: z.string().optional(),
    expiryMonth: z.string().optional(),
    expiryYear: z.string().optional(),
  }),
  invalidated: z.boolean(),
});

// ─────────────────────────────────────────────────────────────
// Error Response
// ─────────────────────────────────────────────────────────────

/**
 * Payment handler error response schema
 */
export const PaymentHandlerErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    declineCode: z.string().optional(),
    retryable: z.boolean(),
    requiresAction: z.object({
      type: z.literal('3ds_authentication'),
      redirectUrl: z.string().url(),
    }).optional(),
  }),
});

// ─────────────────────────────────────────────────────────────
// Type Exports
// ─────────────────────────────────────────────────────────────

export type TokenizeRequestInput = z.input<typeof TokenizeRequestSchema>;
export type TokenizeResponseOutput = z.output<typeof TokenizeResponseSchema>;
export type DetokenizeRequestInput = z.input<typeof DetokenizeRequestSchema>;
export type DetokenizeResponseOutput = z.output<typeof DetokenizeResponseSchema>;
