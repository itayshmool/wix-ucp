/**
 * Common Validation Schemas
 * 
 * Zod schemas for common UCP types.
 */

import { z } from 'zod';

/**
 * Money schema - amounts in minor units
 */
export const MoneySchema = z.object({
  amount: z.number().int().min(0, 'Amount must be non-negative'),
  currency: z.string().length(3, 'Currency must be 3 characters (ISO 4217)').toUpperCase(),
});

/**
 * Address schema
 */
export const AddressSchema = z.object({
  line1: z.string().min(1, 'Address line 1 is required').max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().max(100).optional(),
  postalCode: z.string().min(1, 'Postal code is required').max(20),
  country: z.string().length(2, 'Country must be 2 characters (ISO 3166-1)').toUpperCase(),
});

/**
 * Email schema with validation
 */
export const EmailSchema = z.string().email('Invalid email format').max(254);

/**
 * Phone schema (E.164 format recommended)
 */
export const PhoneSchema = z.string().min(1).max(30).regex(
  /^[+]?[0-9\s\-().]+$/,
  'Invalid phone number format'
);

/**
 * Buyer schema
 */
export const BuyerSchema = z.object({
  email: EmailSchema,
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phone: PhoneSchema.optional(),
  address: AddressSchema.optional(),
});

/**
 * Partial buyer schema (for updates)
 */
export const PartialBuyerSchema = BuyerSchema.partial();

/**
 * Item details schema
 */
export const ItemDetailsSchema = z.object({
  id: z.string().min(1, 'Item ID is required'),
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(2000).optional(),
  price: z.number().int().min(0, 'Price must be non-negative'),
  imageUrl: z.string().url('Invalid image URL').optional(),
  productUrl: z.string().url('Invalid product URL').optional(),
});

/**
 * Line item schema
 */
export const LineItemSchema = z.object({
  id: z.string().min(1, 'Line item ID is required'),
  item: ItemDetailsSchema,
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  totalPrice: z.number().int().min(0, 'Total price must be non-negative'),
});

/**
 * Total type enum
 */
export const TotalTypeSchema = z.enum([
  'SUBTOTAL',
  'SHIPPING',
  'TAX',
  'DISCOUNT',
  'TOTAL',
]);

/**
 * Total schema
 */
export const TotalSchema = z.object({
  type: TotalTypeSchema,
  label: z.string().min(1).max(100),
  amount: z.number().int(),
});

/**
 * Fulfillment type enum
 */
export const FulfillmentTypeSchema = z.enum([
  'SHIPPING',
  'PICKUP',
  'DIGITAL',
  'SERVICE',
]);

/**
 * Fulfillment option schema
 */
export const FulfillmentOptionSchema = z.object({
  id: z.string().min(1),
  type: FulfillmentTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  price: z.number().int().min(0),
  estimatedDelivery: z.string().optional(),
});

/**
 * Metadata schema (key-value pairs)
 */
export const MetadataSchema = z.record(z.string(), z.string()).optional();

/**
 * UUID schema
 */
export const UUIDSchema = z.string().uuid('Invalid UUID format');

/**
 * ISO 8601 date-time schema
 */
export const DateTimeSchema = z.string().datetime({ message: 'Invalid ISO 8601 date-time' });

// Type exports
export type MoneyInput = z.input<typeof MoneySchema>;
export type MoneyOutput = z.output<typeof MoneySchema>;
export type AddressInput = z.input<typeof AddressSchema>;
export type BuyerInput = z.input<typeof BuyerSchema>;
export type LineItemInput = z.input<typeof LineItemSchema>;
export type TotalInput = z.input<typeof TotalSchema>;
