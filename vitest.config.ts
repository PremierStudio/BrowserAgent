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
      // src/cli.ts is the thin stdio entry point: it calls buildCliMain() at
      // module load, which would start a real server, so it cannot be
      // imported in tests. All of its logic lives in buildCliMain, which is
      // covered at 100% via src/protocol/cli.ts.
      exclude: ['src/cli.ts'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
})
