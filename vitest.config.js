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
  }
}))
