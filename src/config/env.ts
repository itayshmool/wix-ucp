import { z } from 'zod';

/**
 * Environment variable schema with validation
 */
const envSchema = z.object({
  // Node
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Redis
  REDIS_URL: z.string().url(),
  
  // Wix API
  WIX_API_KEY: z.string().min(1),
  WIX_ACCOUNT_ID: z.string().min(1),
  WIX_SITE_ID: z.string().min(1),
  
  // UCP Configuration
  UCP_HANDLER_ID: z.string().default('com.wix.payments'),
  UCP_VERSION: z.string().default('2026-01-11'),
  UCP_BASE_URL: z.string().url().optional(),
  
  // Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  WEBHOOK_SECRET: z.string().min(16).optional(),
  
  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate and load environment variables
 * Throws detailed error if validation fails
 */
function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    const errors = result.error.errors.map(e => `  - ${e.path.join('.')}: ${e.message}`);
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }
  
  return result.data;
}

// Export validated environment (will throw on import if invalid)
export const env = loadEnv();
