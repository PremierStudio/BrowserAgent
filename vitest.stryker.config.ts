import { defineConfig } from 'vitest/config'

// Stryker drives Vitest in-process. The main vitest.config.ts writes a
// shared JUnit file and enforces coverage thresholds, both of which hang
// or fail mutant runs. Integration tests launch Chrome and must stay out.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**'],
    environment: 'node',
  },
})
