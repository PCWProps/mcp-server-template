// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // Base JavaScript recommended rules
  js.configs.recommended,

  // TypeScript strict recommended rules
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Prettier compatibility (must be last to disable formatting rules)
  eslintConfigPrettier,

  // Project-specific configuration
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Prevent accidentally forgotten async error handling
      '@typescript-eslint/no-floating-promises': 'error',

      // Require explicit return types on exported functions for better API clarity
      '@typescript-eslint/explicit-module-boundary-types': 'error',

      // Allow void return type shorthand in callbacks
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        { ignoreArrowShorthand: true },
      ],

      // Prevent misuse of promises (e.g. passing async callbacks where sync expected)
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            arguments: false,
          },
        },
      ],

      // Allow underscore-prefixed unused vars (conventional "intentionally unused")
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Prefer nullish coalescing over logical OR for default values
      '@typescript-eslint/prefer-nullish-coalescing': 'error',

      // Enforce consistent type assertions
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'allow-as-parameter' },
      ],

      // Require type-only imports to use `import type`
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // Allow explicit `any` with a comment explanation (avoid overly strict)
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Test files get relaxed rules
  {
    files: ['src/tests/**/*.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },

  // Scripts get Node.js globals and relaxed rules
  {
    files: ['scripts/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-console': 'off',
    },
  },

  // Ignore generated and build output
  {
    ignores: [
      'dist/',
      '.wrangler/',
      'coverage/',
      'node_modules/',
      'worker-configuration.d.ts',
    ],
  },
);
