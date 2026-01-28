import { defineConfig } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

const eslintConfig = defineConfig([
  {
    ignores: [
      // Dependencies
      'node_modules/**',

      // Next.js build outputs
      '.next/**',
      'out/**',
      'build/**',

      // Testing outputs
      'coverage/**',
      'coverage-*/**',
      'test-results/**',
      'playwright-report/**',

      // History and IDE
      '.history/**',
      '.vscode/**',

      // Build artifacts
      '*.tsbuildinfo',
      'next-env.d.ts',
      'tsconfig*.tsbuildinfo',

      // Database and data
      '*.db',
      '*.db-journal',
      'data/**',
      'backups/**',
      'test-data/**',

      // Logs and temporary files
      '*.log',
      'output.log',
      'temp-*.ts',
      'temp-*.txt',
      'temp-*.json',

      // Test output files (root level)
      'test-*.txt',
      '*-test.txt',
      '*-test-output.txt',
      '*-test-results.txt',
      '*-report.txt',
      '*-report.json',
      '*-output.txt',
      '*-final.txt',
      '*-detailed.txt',
      '*-fixed.txt',
      '*-v2.txt',
      '*-v3.txt',
      'admin-*.txt',
      'day*-test-*.txt',
      'coverage-*.txt',
      'lib-test-*.txt',
      'order-*.txt',
      'payment-*.txt',
      'risk-*.txt',
      'team-*.txt',
      'stats-*.txt',
      'evidence-*.txt',
      'reports-*.txt',
      'api-*.txt',
      'invoice-*.txt',
      'usage-history-*.txt',

      // Environment
      '.env*',

      // Vercel
      '.vercel/**',

      // Config files (already validated)
      'config/**',

      // Test artifacts
      'public/uploads/**',

      // Generated files
      '/src/generated/prisma/**',

      // Additional temporary files
      'esl',
      'nul',
      '*.cache',
    ],
  },
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      // Relaxed TypeScript rules for speed
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Override rules for test files
  {
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/__tests__/**/*.ts',
      '**/__tests__/**/*.tsx',
    ],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]);

export default eslintConfig;
