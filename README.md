# BrowserAgent

> A unified, event-driven, visually-rich **MCP browser-automation server** on Puppeteer — built so the semantic layer and the visual layer are the _same object_.

BrowserAgent is a from-scratch [Model Context Protocol](https://modelcontextprotocol.io) server that lets an LLM **read** a page and **act** on it through one coherent, event-driven model — not two disconnected text/pixel worlds. It is built on Puppeteer (not raw CDP, not Playwright) because Puppeteer's raw CDP access is what makes a11y trees, bounding boxes, traces, and heap snapshots possible.

**Status: under active development.** Milestones M0–M4 and M3 are complete and fully green (100% coverage + 100% mutation score). M5 (the MCP protocol layer) is in progress. The tool framework, page model, diff engine, event layer, and action primitives are all implemented and tested; the runnable server entry point is next.

---

## The thesis

Most browser integrations treat "read the page" and "act on the page" as separate worlds — one that returns text, one that returns pixels. That split forces the model to re-read the page every turn and to guess at the relationship between what it sees and what it can click.

BrowserAgent's core idea: **build one unified, event-driven, visually-rich model where the semantic layer and the visual layer are the same object** — and where the model can both watch and explain.

The product surface (in dependency order):

| #   | Piece                                                                                                                    | Status              |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| 1   | **`observe`** — the unified primitive: a11y snapshot with `uid` + bounding box + zIndex, screenshot, `uid → box` overlay | ✅ M1               |
| 2   | **Diff engine** — observe returns changes since the last call, not the whole tree                                        | ✅ M2               |
| 3   | **Event / subscription layer** — console, network, DOM, navigation events                                                | ✅ M4               |
| 4   | **Semantic action log** — every action records `{action, uid, box, timestamp}` (the seed of replay)                      | ✅ M3               |
| 5   | **Action primitives** — click, type, hover, scroll, select, press, navigate, each with the act-then-wait wrapper         | ✅ M3               |
| 6   | **MCP protocol layer** — `tools/list`, `tools/call`, `server/discover`, Tool Annotations on the v2 SDK                   | 🔶 M5 (in progress) |
| 7   | **MCP Apps replay/annotation UI** — scrubbable, animated replay of the action log                                        | ⏳ M7               |
| 8   | **Tasks + MRTR** — `watch_until`, `run_flow`, human-in-the-loop gates                                                    | ⏳ M5–M6            |
| 9   | **Intent tools** — `verify` (pass/fail with evidence), `explain` (annotated visual + summary)                            | ⏳ M6               |

---

## Why another browser MCP server?

It's not a fork of `chrome-devtools-mcp`. It borrows chrome-devtools-mcp's _proven patterns_ — stable element uids keyed by `loaderId_backendNodeId`, a `ContextPage` abstraction that hides Puppeteer behind a narrow contract, an "act then wait for stable DOM/navigation" wrapper, and token-optimized formatters — and rebuilds them from scratch around a different product shape.

The design principles that make it different:

- **Unified observe, not split snapshot/screenshot.** One call returns the a11y tree _with_ the pixel overlay, so the model never has to reconcile text and images itself.
- **Diff, don't re-read.** The diff engine (with fingerprint-based uid rebinding across navigation) means the model doesn't pay to re-read the whole page every turn.
- **Events, not polling.** The event layer collects console/network/DOM/navigation events; the server pushes changes instead of the model polling.
- **Fewer round trips over micro-optimization.** The browser and the LLM are the bottlenecks — performance comes from the diff engine and event-driven observation, not from shaving milliseconds.

---

## Engineering: strict TDD with a 100/100 gate

Every module in this repo is written test-first (RED → GREEN → refactor) and must clear a hard, CI-enforced gate before it is committed:

```
typecheck → lint → format → knip → unit tests → coverage (100%) → mutation (100%) → survivor registry
```

- **100% coverage** (lines/branches/functions/statements) via Vitest + `@vitest/coverage-v8`.
- **100% mutation score** via Stryker — coverage alone is a lie; mutation testing proves the tests actually catch real faults. The only escape from the mutation gate is a pre-approved, documented entry in `mutation-survivors.json` (currently empty).
- **No dead code.** knip runs with zero findings — unused files, exports, and dependencies are removed, not ignored.
- **TypeScript only, everywhere.** No `.js`/`.mjs`/`.cjs` anywhere — source, configs (`eslint.config.ts`, `stryker.config.ts`, `vitest.config.ts`), and scripts (emitted to `dist-scripts/` via `tsconfig.scripts.json`).
- **No banned constructs.** `as` casts, `any`, `!` non-null assertions, `@ts-ignore`/`@ts-nocheck`/`@ts-expect-error`, and `.forEach` are all lint errors.
- **Deterministic tests.** Clocks and timers are injected — no sleeps, no flaky timing.

The full engineering spec lives in [`docs/mvp.md`](docs/mvp.md); every deviation and protocol decision is recorded in [`docs/decisions.md`](docs/decisions.md).

---

## Repository layout

```
src/
  actions/       ActionLog (replay seed), ActionRunner, StabilityWaiter (act-then-wait)
  context/       ContextPage abstraction + CDP a11y-tree conversion (axTree)
  diff/          diff engine, fingerprint-based uid rebinding, DiffTracker
  events/        event types, bounded EventBuffer, normalizer, EventCollector
  protocol/      MCP tool bridge to @modelcontextprotocol/server v2
  snapshot/      a11y snapshot builder + uid→box overlay
  tools/         tool framework: defineTool, ToolHandler, ToolMutex, Response, observe
  uid.ts         stable loaderId_backendNodeId uid generation
docs/
  mvp.md         the product plan and non-negotiable engineering requirements
  decisions.md   every amendment (supersedes mvp.md where they conflict)
scripts/         survivor-registry checker (TypeScript, emitted to dist-scripts/)
.github/workflows/ci.yml
```

---

## Getting started

> ⚠️ The runnable server entry point (stdio transport + `server.connect`) is part of the in-progress M5 milestone. Today the repo is a fully-tested library of the server's core layers.

```bash
git clone https://github.com/PremierStudio/BrowserAgent.git
cd BrowserAgent
npm install
```

**Run the full gate chain** (what CI enforces):

```bash
npm run ci
```

**Individual gates:**

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run format       # Prettier check
npm run knip         # dead code / unused deps
npm test             # Vitest
npm run coverage     # 100% threshold
npm run mutation     # Stryker, 100% threshold
npm run reports      # coverage + JUnit XML into reports/
```

**Requirements:** Node `>= 20.19`, npm. TypeScript `^6.0.3` (TS 6 — not the 7.x Go port; the tooling isn't TS-7-ready yet, see `docs/decisions.md` #16).

---

## Architecture in one screen

```text
                     ┌──────────────────────────────────────────────┐
                     │            MCP protocol layer (M5)            │
                     │  tools/list · tools/call · server/discover    │
                     │  Tool Annotations · (Tasks · Apps · MRTR)     │
                     └───────────────┬──────────────────────────────┘
                                     │ registerTools → ToolCaller
                     ┌───────────────▼──────────────────────────────┐
                     │            Tool framework (M1)                │
                     │  defineTool · ToolHandler · mutex · Response  │
                     │  category gating · experimental gating        │
                     │  unknown-arg rejection · write serialization  │
                     └───────────────┬──────────────────────────────┘
                                     │ narrow contract, no raw Puppeteer
          ┌──────────────┬───────────▼───────────┬──────────────────┐
          │              │                       │                  │
  ┌───────▼───────┐ ┌────▼─────────┐ ┌──────────▼──────┐ ┌────────▼───────┐
  │ ContextPage   │ │ Diff engine  │ │ Event layer     │ │ Action layer   │
  │ getElementByUid│ │ (M2)        │ │ (M4)            │ │ (M3)           │
  │ observe       │ │ diffSnapshots│ │ EventBuffer     │ │ ActionLog      │
  │ emulate       │ │ fingerprint  │ │ EventCollector  │ │ StabilityWaiter│
  │ click/type/…  │ │ DiffTracker  │ │ normalize       │ │ ActionRunner   │
  └───────┬───────┘ └──────┬───────┘ └────────┬───────┘ └────────┬───────┘
          │                │                  │                  │
          └────────────────┴──────────────────┴──────────────────┘
                                     │
                          ┌──────────▼──────────┐
                          │  Puppeteer / CDP    │
                          │  (headless Chrome)  │
                          └─────────────────────┘
```

---

## Roadmap

| Milestone | Content                                                                                                                                 |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **M0** ✅ | Tooling + test infrastructure: strict TS, knip, ESLint/Prettier, Vitest 100% coverage, Stryker 100% mutation, CI                        |
| **M1** ✅ | Core page model: stable uids, `ContextPage`, a11y snapshot + bounding boxes, `observe`                                                  |
| **M2** ✅ | Diff engine: change detection, value tracking, fingerprint uid rebinding, `DiffTracker`                                                 |
| **M4** ✅ | Event layer: console/network/DOM/navigation collection (events before actions, per decision #11)                                        |
| **M3** ✅ | Action primitives + wait wrapper: click/type/hover/scroll/select/press/navigate, action log                                             |
| **M5** 🔶 | MCP protocol layer: stdio + Streamable HTTP, `tools/list`/`tools/call`, Tool Annotations, Tasks extension, MRTR, `subscriptions/listen` |
| **M6** ⏳ | Intent tools: `watch_until`, `run_flow`, `verify`, `explain`                                                                            |
| **M7** ⏳ | MCP Apps replay/annotation UI: `ui://` resource, animated replay, timeline scrubber                                                     |
| **M8** ⏳ | Hardening: full mutation pass, edge cases, docs, final CI green                                                                         |

_(M3/M4 are ordered per decision #11 — events before actions, because `act-then-wait` depends on DOM-stability/navigation events.)_

---

## Contributing

This repo follows the rules in [`AGENTS.md`](AGENTS.md) (binding for every agent) and the spec in [`docs/mvp.md`](docs/mvp.md). The short version:

- **Strict TDD** — failing test first (RED), confirm it fails for the right reason, then implement (GREEN), then refactor.
- **The 100/100 gate** — no module merges unless it's at 100% coverage _and_ 100% mutation score, with typecheck/lint/format/knip clean.
- **No survivor silencing** — a surviving mutant is fixed by strengthening the test, never by weakening the code or adding ignore comments. The only escape is a documented entry in `mutation-survivors.json`.
- **TypeScript only** — no `.js`/`.mjs`/`.cjs`, including configs and scripts.

See [`docs/mvp.md`](docs/mvp.md) for the full engineering requirements and [`docs/decisions.md`](docs/decisions.md) for every decision made so far.

---

## License

To be decided — this repo currently has no license file, which under copyright law means **all rights reserved** by default. If you'd like this to be genuinely open source, a license needs to be added (say the word and I'll add one).
