/**
 * Validation Utility Functions
 * 
 * Helpers for schema validation and request parsing.
 */

import type { ZodSchema, ZodError } from 'zod';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { UCPException } from '../types/index.js';
import { createValidationError, zodErrorsToDetails } from './errors.js';

/**
 * Result of a validation operation
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: ZodError };

/**
 * Validate data against a Zod schema
 */
export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, error: result.error };
}

/**
 * Validate and throw UCPException on failure
 */
export function validateOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    throw new UCPException('INVALID_REQUEST', 'Request validation failed', {
      details: zodErrorsToDetails(result.error.errors),
    });
  }
  
  return result.data;
}

/**
 * Parse and validate request body
 */
export async function parseBody<T>(
  request: FastifyRequest,
  schema: ZodSchema<T>
): Promise<T> {
  return validateOrThrow(schema, request.body);
}

/**
 * Parse and validate request query parameters
 */
export function parseQuery<T>(
  request: FastifyRequest,
  schema: ZodSchema<T>
): T {
  return validateOrThrow(schema, request.query);
}

/**
 * Parse and validate request path parameters
 */
export function parseParams<T>(
  request: FastifyRequest,
  schema: ZodSchema<T>
): T {
  return validateOrThrow(schema, request.params);
}

/**
 * Create a Fastify preValidation hook for body validation
 */
export function createBodyValidator<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.body);
    
    if (!result.success) {
      const error = createValidationError(result.error.errors);
      return reply.status(400).send(error);
    }
    
    // Replace body with validated/transformed data
    (request as { body: T }).body = result.data;
  };
}

/**
 * Create a Fastify preValidation hook for query validation
 */
export function createQueryValidator<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.query);
    
    if (!result.success) {
      const error = createValidationError(result.error.errors);
      return reply.status(400).send(error);
    }
    
    (request as { query: T }).query = result.data;
  };
}

/**
 * Create a Fastify preValidation hook for params validation
 */
export function createParamsValidator<T>(schema: ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.params);
    
    if (!result.success) {
      const error = createValidationError(result.error.errors);
      return reply.status(400).send(error);
    }
    
    (request as { params: T }).params = result.data;
  };
}

/**
 * Validate that at least one of the specified fields is present
 */
export function requireOneOf<T extends Record<string, unknown>>(
  data: T,
  fields: (keyof T)[]
): boolean {
  return fields.some((field) => data[field] !== undefined);
}

/**
 * Validate that all specified fields are present
 */
export function requireAll<T extends Record<string, unknown>>(
  data: T,
  fields: (keyof T)[]
): boolean {
  return fields.every((field) => data[field] !== undefined);
}

/**
 * Strip undefined values from an object
 */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  
  return result;
}

/**
 * Check if a string is a valid UUID
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Check if a string is a valid ISO 8601 date-time
 */
export function isValidDateTime(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime()) && value === date.toISOString();
}

/**
 * Check if a currency code is valid (ISO 4217)
 */
export function isValidCurrency(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

/**
 * Check if a country code is valid (ISO 3166-1 alpha-2)
 */
export function isValidCountryCode(code: string): boolean {
  return /^[A-Z]{2}$/.test(code);
}
