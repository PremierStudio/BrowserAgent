// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: 'vitest',
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
