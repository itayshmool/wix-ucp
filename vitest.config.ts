import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Global test settings
    globals: true,
    environment: 'node',
    
    // Test file patterns
    include: [
      'src/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    exclude: [
      'node_modules',
      'dist',
    ],
    
    // Setup files
    setupFiles: ['./tests/setup.ts'],
    
    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Coverage configuration
    // Minimum 70% as per practices/testing.mdc
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html'],
      reportsDirectory: './coverage',
      
      // Files to include in coverage
      include: ['src/**/*.ts'],
      
      // Files to exclude from coverage
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/server.ts',      // Entry point
        'src/config/env.ts',  // Environment config
        'node_modules/**',
      ],
      
      // Coverage thresholds (fail if below)
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
    
    // Reporter settings
    reporters: ['verbose'],
    
    // Pool settings for parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },
  
  // Path aliases (match tsconfig.json)
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/core': resolve(__dirname, './src/core'),
      '@/modules': resolve(__dirname, './src/modules'),
      '@/adapters': resolve(__dirname, './src/adapters'),
      '@/lib': resolve(__dirname, './src/lib'),
    },
  },
});
