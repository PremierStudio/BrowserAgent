import type { KnipConfiguration } from 'knip'

// knip's built-in Stryker plugin defaults to non-TS config globs
// (`stryker.config.{js,mjs,cjs,json}`), so it never loads our TypeScript-only
// `stryker.config.ts`. Point the plugin's `config` at the `.ts` file: knip
// then parses it and derives `@stryker-mutator/vitest-runner` from
// `testRunner: 'vitest'` (instead of flagging it as an unused dependency).
//
// `@stryker-mutator/api` is consumed exclusively as a type
// (`import type { PartialStrykerOptions }` in `stryker.config.ts`) and has no
// runtime import anywhere, so knip's default dependency analysis reports it as
// unused; ignoring it records that decision deliberately.
const config: KnipConfiguration = {
  entry: ['scripts/*.ts'],
  stryker: { config: ['stryker.config.ts'] },
  ignoreDependencies: ['@stryker-mutator/api'],
}

export default config
