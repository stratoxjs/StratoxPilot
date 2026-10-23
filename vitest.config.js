import { defineConfig } from 'vitest/config'
import { distAlias } from './vitest.dist.js';

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: distAlias(mode),
  },
  test: {
    exclude: [
      'node_modules',
      'packages'
    ],
    coverage: {
      include: ['src/**'],
    },
    // Type-level tests of the public API (roadmap 5.4): checked by tsc, never run
    typecheck: {
      enabled: true,
      include: ['spec/**/*.test-d.ts'],
      tsconfig: './tsconfig.spec.json',
    },
  }
}))
