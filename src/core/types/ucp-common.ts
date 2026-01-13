/**
 * UCP Common Types
 * 
 * Shared type definitions used across all UCP modules.
 * Based on UCP Protocol Specification v2026-01-11
 */

/**
 * UCP protocol version metadata
 */
export interface UCPVersion {
  /** Protocol version string (e.g., "2026-01-11") */
  version: string;
  /** URL to the UCP specification */
  spec: string;
}

/**
 * Money representation in UCP
 * All amounts are in minor units (e.g., cents for USD)
 */
export interface Money {
  /** Amount in minor units (e.g., 1000 = $10.00) */
  amount: number;
  /** ISO 4217 currency code (e.g., "USD", "EUR") */
  currency: string;
}

/**
 * Address structure used across UCP
 */
export interface Address {
  /** Street address line 1 */
  line1: string;
  /** Street address line 2 (optional) */
  line2?: string;
  /** City name */
  city: string;
  /** State/Province/Region (optional) */
  state?: string;
  /** Postal/ZIP code */
  postalCode: string;
  /** ISO 3166-1 alpha-2 country code (e.g., "US", "GB") */
  country: string;
}

/**
 * Buyer information
 */
export interface Buyer {
  /** Buyer's email address */
  email: string;
  /** Buyer's first name (optional) */
  firstName?: string;
  /** Buyer's last name (optional) */
  lastName?: string;
  /** Buyer's phone number (optional) */
  phone?: string;
  /** Buyer's address (optional) */
  address?: Address;
}

/**
 * Item type (physical vs digital)
 */
export type ItemType = 'physical' | 'digital' | 'service';

/**
 * Item details within a line item
 */
export interface ItemDetails {
  /** Unique item/product ID */
  id: string;
  /** Item title/name */
  title: string;
  /** Item description (optional) */
  description?: string;
  /** Unit price in minor units */
  price: number;
  /** URL to item image (optional) */
  imageUrl?: string;
  /** URL to product page (optional) */
  productUrl?: string;
  /** Item type (physical, digital, service) - defaults to physical */
  type?: ItemType;
}

/**
 * Line item in checkout
 */
export interface LineItem {
  /** Unique line item ID */
  id: string;
  /** Item details */
  item: ItemDetails;
  /** Quantity ordered */
  quantity: number;
  /** Total price (quantity × unit price) in minor units */
  totalPrice: number;
}

/**
 * Total breakdown types
 */
export type TotalType =
  | 'SUBTOTAL'
  | 'SHIPPING'
  | 'TAX'
  | 'DISCOUNT'
  | 'TOTAL';

/**
 * Total line in checkout breakdown
 */
export interface Total {
  /** Type of total */
  type: TotalType;
  /** Display label */
  label: string;
  /** Amount in minor units */
  amount: number;
}

/**
 * Fulfillment option types
 */
export type FulfillmentType =
  | 'SHIPPING'
  | 'PICKUP'
  | 'DIGITAL'
  | 'SERVICE';

/**
 * Fulfillment option
 */
export interface FulfillmentOption {
  /** Unique option ID */
  id: string;
  /** Fulfillment type */
  type: FulfillmentType;
  /** Display title */
  title: string;
  /** Description (optional) */
  description?: string;
  /** Cost in minor units */
  price: number;
  /** Estimated delivery time (optional) */
  estimatedDelivery?: string;
}

/**
 * Selected fulfillment info
 */
export interface FulfillmentInfo {
  /** Selected fulfillment option ID */
  optionId: string;
  /** Fulfillment type */
  type: FulfillmentType;
  /** Shipping address (for SHIPPING type) */
  shippingAddress?: Address;
  /** Pickup location ID (for PICKUP type) */
  pickupLocationId?: string;
}
