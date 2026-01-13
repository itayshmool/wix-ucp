/**
 * Checkout Schemas
 * 
 * Zod validation schemas for checkout API requests.
 * See: .cursor/rules/modules/checkout.mdc
 */

import { z } from 'zod';
import { AddressSchema, BuyerSchema } from '../../core/schemas/common.schema.js';

// ─────────────────────────────────────────────────────────────
// Common Schemas
// ─────────────────────────────────────────────────────────────

/**
 * Catalog reference schema
 */
export const CatalogReferenceSchema = z.object({
  catalogItemId: z.string().min(1, 'Catalog item ID is required'),
  appId: z.string().min(1, 'App ID is required'),
  options: z.object({
    variantId: z.string().optional(),
    customTextFields: z.record(z.string()).optional(),
  }).optional(),
});

/**
 * Line item input schema
 */
export const LineItemInputSchema = z.object({
  catalogReference: CatalogReferenceSchema,
  quantity: z.number().int().positive('Quantity must be positive'),
});

/**
 * Buyer input schema (partial for updates)
 */
export const BuyerInputSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────
// Create Checkout Schema
// ─────────────────────────────────────────────────────────────

export const CreateCheckoutSchema = z.object({
  currency: z.string().length(3, 'Currency must be 3-letter ISO code').toUpperCase(),
  buyer: BuyerInputSchema.optional(),
  lineItems: z.array(LineItemInputSchema).min(1, 'At least one line item is required'),
  shippingAddress: AddressSchema.optional(),
  billingAddress: AddressSchema.optional(),
  discountCode: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

export type CreateCheckoutInput = z.infer<typeof CreateCheckoutSchema>;

// ─────────────────────────────────────────────────────────────
// Update Checkout Schema
// ─────────────────────────────────────────────────────────────

export const UpdateCheckoutSchema = z.object({
  buyer: z.object({
    email: z.string().email().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
  shippingAddress: AddressSchema.optional(),
  billingAddress: AddressSchema.optional(),
  selectedFulfillment: z.string().optional(),
  discountCode: z.string().nullable().optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one field must be provided for update' }
);

export type UpdateCheckoutInput = z.infer<typeof UpdateCheckoutSchema>;

// ─────────────────────────────────────────────────────────────
// Complete Checkout Schema
// ─────────────────────────────────────────────────────────────

export const CompleteCheckoutSchema = z.object({
  paymentData: z.object({
    id: z.string().min(1, 'Payment instrument ID is required'),
    handlerId: z.string().min(1, 'Payment handler ID is required'),
    credential: z.object({
      type: z.literal('token'),
      token: z.string().min(1, 'Payment token is required'),
    }),
    billingAddress: AddressSchema.optional(),
  }),
  idempotencyKey: z.string().min(1, 'Idempotency key is required').max(64),
});

export type CompleteCheckoutInput = z.infer<typeof CompleteCheckoutSchema>;

// ─────────────────────────────────────────────────────────────
// Route Parameter Schemas
// ─────────────────────────────────────────────────────────────

export const CheckoutIdParamSchema = z.object({
  checkoutId: z.string().regex(/^chk_[a-f0-9]{32}$/, 'Invalid checkout ID format'),
});

export type CheckoutIdParam = z.infer<typeof CheckoutIdParamSchema>;

// ─────────────────────────────────────────────────────────────
// Query Parameter Schemas
// ─────────────────────────────────────────────────────────────

export const GetFulfillmentOptionsQuerySchema = z.object({
  includeAddress: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
});

export type GetFulfillmentOptionsQuery = z.infer<typeof GetFulfillmentOptionsQuerySchema>;
