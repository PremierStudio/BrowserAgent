import type { KnipConfiguration } from 'knip'

// knip's built-in Stryker plugin defaults to non-TS config globs
// (`stryker.config.{js,mjs,cjs,json}`), so it never loads our TypeScript-only
// `stryker.config.ts`. Point the plugin's `config` at the `.ts` file: knip
// then parses it and derives `@stryker-mutator/vitest-runner` from
// `testRunner: 'vitest'` (instead of flagging it as an unused dependency).
//
// `puppeteer` is the browser-automation core the whole server is built on.
// `ContextPage` deliberately wraps it behind a structural `PageLike` contract
// (so tools and unit tests never touch the raw Puppeteer Page), which means
// there is no direct `import ... from 'puppeteer'` in `src/` yet. It is a real
// runtime dependency of the product, so we record that decision here rather
// than removing it.
const config: KnipConfiguration = {
  entry: ['scripts/*.ts', 'src/cli.ts'],
  stryker: { config: ['stryker.config.ts'] },
  ignoreDependencies: ['puppeteer'],
}

export default config
