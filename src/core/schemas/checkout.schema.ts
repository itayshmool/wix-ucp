/**
 * Checkout Validation Schemas
 * 
 * Zod schemas for checkout-related requests.
 */

import { z } from 'zod';
import {
  BuyerSchema,
  PartialBuyerSchema,
  AddressSchema,
  MetadataSchema,
} from './common.schema.js';

/**
 * Checkout status enum
 */
export const CheckoutStatusSchema = z.enum([
  'incomplete',
  'ready_for_payment',
  'ready_for_complete',
  'requires_action',
  'completed',
  'expired',
  'cancelled',
]);

/**
 * Create checkout request schema
 */
export const CreateCheckoutRequestSchema = z.object({
  /** Currency code (ISO 4217) */
  currency: z.string().length(3, 'Currency must be 3 characters').toUpperCase(),
  
  /** Buyer information (optional) */
  buyer: BuyerSchema.optional(),
  
  /** Line items to add to checkout */
  lineItems: z.array(z.object({
    /** Product/Item ID */
    itemId: z.string().min(1, 'Item ID is required'),
    /** Quantity to add */
    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  })).min(1, 'At least one line item is required'),
  
  /** Custom metadata */
  metadata: MetadataSchema,
});

/**
 * Update checkout request schema
 */
export const UpdateCheckoutRequestSchema = z.object({
  /** Updated buyer information */
  buyer: PartialBuyerSchema.optional(),
  
  /** Selected fulfillment option ID */
  fulfillmentOptionId: z.string().min(1).optional(),
  
  /** Shipping address */
  shippingAddress: AddressSchema.optional(),
  
  /** Custom metadata */
  metadata: MetadataSchema,
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

/**
 * Payment credential schema
 */
export const PaymentCredentialSchema = z.object({
  type: z.literal('token'),
  token: z.string().min(1, 'Token is required'),
});

/**
 * Complete checkout request schema
 */
export const CompleteCheckoutRequestSchema = z.object({
  /** Payment information */
  payment: z.object({
    /** Payment handler ID */
    handlerId: z.string().min(1, 'Handler ID is required'),
    /** Payment instrument ID */
    instrumentId: z.string().min(1, 'Instrument ID is required'),
    /** Payment credential */
    credential: PaymentCredentialSchema,
    /** Billing address (optional) */
    billingAddress: AddressSchema.optional(),
  }),
});

/**
 * Checkout ID parameter schema
 */
export const CheckoutIdParamSchema = z.object({
  checkoutId: z.string().min(1, 'Checkout ID is required'),
});

// Type exports
export type CreateCheckoutInput = z.input<typeof CreateCheckoutRequestSchema>;
export type UpdateCheckoutInput = z.input<typeof UpdateCheckoutRequestSchema>;
export type CompleteCheckoutInput = z.input<typeof CompleteCheckoutRequestSchema>;
