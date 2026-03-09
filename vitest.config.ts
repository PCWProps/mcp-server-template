import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run tests in Node.js environment (not jsdom)
    environment: 'node',

    // Run setup file before all test suites
    setupFiles: ['./src/tests/setup.ts'],

    // Enable Vitest globals (describe, it, expect, etc.) without imports
    globals: true,

    // Test file patterns
    include: ['src/tests/**/*.test.ts', 'src/**/*.test.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/tests/**',
        'src/**/*.test.ts',
        'src/types/**',
        'node_modules/**',
        'dist/**',
      ],
      thresholds: {
        lines: 40,
        functions: 55,
        branches: 60,
        statements: 40,
      },
    },

    // Reporter configuration
    reporter: process.env['CI'] ? 'verbose' : 'default',

    // Timeout for individual tests (ms)
    testTimeout: 10_000,

    // Timeout for hook functions (ms)
    hookTimeout: 10_000,
  },
});
