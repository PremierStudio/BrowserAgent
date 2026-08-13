# BrowserEngine — agent rules

These rules are binding for every agent working in this repository. They
supersede generic habits; when in doubt, follow the letter here.

## TypeScript only — no JavaScript anywhere

- **Only TypeScript (`.ts`) is allowed in this repo.** No `.js`, `.mjs`, or
  `.cjs` source, config, script, or build files. Zero exceptions.
- This applies to **project configuration too**: `eslint.config.ts`,
  `stryker.config.ts`, `vitest.config.ts`, and `tsconfig*.json`. Never reach
  for `.mjs`/`.js`/`.cjs` variants "because tools expect them" — the pinned
  tooling versions here load TypeScript configs natively.
- **Scripts** (anything in `scripts/`, plus anything run as `node ...` from
  `package.json`) must be TypeScript, compiled via a dedicated emit build
  (`tsconfig.scripts.json` → `dist-scripts/`) when they need to run as plain
  Node. Do not write JS helper scripts, prebuild steps, or commit hooks in
  JavaScript.
- The CI gate chain (`npm run ci`) enforces this with `git diff --exit-code`
  after formatting and with knip/lint — a `.js`/`.mjs`/`.cjs` file anywhere
  in the tree (outside the auto-generated and gitignored `dist-scripts/`,
  `coverage/`, `reports/`) will fail the gates.
- If a tool or upstream example suggests a `.mjs`/`.js` file, translate it to
  TypeScript. Escaping to JavaScript to work around a tooling quirk is not
  allowed; fix the tooling (pin a version, add a typed wrapper) instead.
- `as` type assertions, `any`, `!` non-null assertions, and
  `@ts-ignore`/`@ts-nocheck`/`@ts-expect-error`/`@ts-check` are banned by
  `eslint.config.ts` — keep the code assertion-free and checkable.

## Engineering rules (binding)

- Follow `docs/mvp.md` and `docs/decisions.md`; where they conflict,
  `docs/decisions.md` wins. Do not relitigate settled decisions.
- Strict TDD: write the failing test first (RED), confirm it fails for the
  right reason, then implement (GREEN), then refactor. No product code before
  its test exists. No batching "write code then test."
- Every module must reach **100% coverage** and a **100% mutation score** from
  Stryker, with `typecheck`/`lint`/`format`/`knip` clean before it may be
  committed. The only escape from the mutation gate is a pre-approved entry in
  `mutation-survivors.json`, enforced by `scripts/survivors.ts` — never
  silence a survivor silently.
- Tests must be truthy and mutation-killing, assert real behavior (not mock
  self-fulfillment), and inject clocks/timers — no sleeps, no flaky timing.
- Use subagents for parallelizable, well-scoped work (per milestone), but the
  orchestrator enforces the gates on every merge; a subagent may not merge
  anything that isn't red→green, mutation-clean, and tooling-clean.
- Keep the repo free of dead code, unused exports, and unused dependencies
  (knip, zero findings).
