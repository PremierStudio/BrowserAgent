import type { PartialStrykerOptions } from '@stryker-mutator/api/core'

// `fileLogLevel` is typed as a const enum (`LogLevel`) whose string form is
// "info". Under `verbatimModuleSyntax` a const enum cannot be imported as a
// value, and plain string literals are not assignable to the const-enum type.
// Stryker validates the real values against its JSON schema at runtime, so we
// keep full type-checking on every other field and widen only this one.
type StrykerConfig = Omit<PartialStrykerOptions, 'fileLogLevel'> & {
  fileLogLevel?: string
}

const config: StrykerConfig = {
  testRunner: 'vitest',
  // Stryker 9 auto-detects only json/js/mjs/cjs; this file must be passed
  // as `stryker run stryker.config.ts` (see package.json "mutation").
  vitest: { configFile: 'vitest.stryker.config.ts' },
  mutate: ['src/**/*.ts'],
  coverageAnalysis: 'perTest',
  concurrency: 4,
  timeoutMS: 30000,
  reporters: ['html', 'json', 'clear-text', 'progress'],
  htmlReporter: { fileName: 'reports/mutation.html' },
  thresholds: { high: 100, low: 100, break: 100 },
  symlinkNodeModules: true,
  tempDirName: '.stryker-tmp',
  fileLogLevel: 'info',
  jsonReporter: { fileName: 'reports/mutation.json' },
  checkers: [],
}

export default config
