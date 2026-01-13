/**
 * Order Validation Schemas
 * 
 * Zod schemas for order management requests.
 */

import { z } from 'zod';
import { DateTimeSchema } from './common.schema.js';

/**
 * Order status enum
 */
export const OrderStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
]);

/**
 * Order ID parameter schema
 */
export const OrderIdParamSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
});

/**
 * List orders request schema
 */
export const ListOrdersRequestSchema = z.object({
  /** Filter by status */
  status: OrderStatusSchema.optional(),
  /** Filter from date (ISO 8601) */
  from: DateTimeSchema.optional(),
  /** Filter to date (ISO 8601) */
  to: DateTimeSchema.optional(),
  /** Maximum results */
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Pagination cursor */
  cursor: z.string().optional(),
});

/**
 * Return reason enum
 */
export const ReturnReasonSchema = z.enum([
  'CHANGED_MIND',
  'DAMAGED',
  'DEFECTIVE',
  'WRONG_ITEM',
  'NOT_AS_DESCRIBED',
  'OTHER',
]);

/**
 * Return line item schema
 */
export const ReturnLineItemSchema = z.object({
  /** Line item ID to return */
  lineItemId: z.string().min(1, 'Line item ID is required'),
  /** Quantity to return */
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  /** Return reason */
  reason: ReturnReasonSchema,
  /** Additional note */
  note: z.string().max(500).optional(),
});

/**
 * Return request schema
 */
export const ReturnRequestSchema = z.object({
  /** Line items to return */
  lineItems: z.array(ReturnLineItemSchema).min(1, 'At least one line item is required'),
});

// Type exports
export type ListOrdersInput = z.input<typeof ListOrdersRequestSchema>;
export type ReturnInput = z.input<typeof ReturnRequestSchema>;
