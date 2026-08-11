import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    reporters: ['default', 'junit'],
    outputFile: { junit: 'reports/junit.xml' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
})
