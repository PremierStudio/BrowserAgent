<p align="center">
  <img alt="BrowserAgent" src="https://raw.githubusercontent.com/PremierStudio/BrowserAgent/master/docs/banner.svg" width="90%"/>
</p>

<p align="center">
  An agent walks the path once. You keep the JSON. CI replays it at zero tokens.
  When a step breaks, the agent files a bug or updates the flow.
</p>

<p align="center">
  <a href="https://github.com/PremierStudio/BrowserAgent/blob/master/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue.svg"/></a>
  <a href="https://github.com/PremierStudio/BrowserAgent/actions"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/PremierStudio/BrowserAgent/ci.yml?branch=master&label=CI&logo=github"/></a>
  <a href="https://github.com/PremierStudio/BrowserAgent"><img alt="Coverage" src="https://img.shields.io/badge/coverage-100%25-brightgreen.svg"/></a>
  <a href="https://github.com/PremierStudio/BrowserAgent"><img alt="Mutation score" src="https://img.shields.io/badge/mutation-100%25-success.svg"/></a>
  <a href="https://github.com/PremierStudio/BrowserAgent"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6.0-blue.svg?logo=typescript&logoColor=white"/></a>
  <a href="https://pptr.dev"><img alt="Puppeteer" src="https://img.shields.io/badge/Puppeteer-25-green.svg?logo=puppeteer&logoColor=white"/></a>
  <a href="https://modelcontextprotocol.io"><img alt="MCP" src="https://img.shields.io/badge/MCP-authoring-orange.svg"/></a>
  <a href="https://nodejs.org"><img alt="Node" src="https://img.shields.io/badge/Node-%3E%3D20.19-339933.svg?logo=nodejs&logoColor=white"/></a>
  <a href="https://github.com/PremierStudio/BrowserAgent/graphs/contributors"><img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg"/></a>
</p>

<p align="center">
  <a href="#what">What it is</a> · <a href="#start">Start</a> · <a href="#flows">Flows</a> ·
  <a href="docs/usage.md">Usage</a> ·
  <a href="docs/architecture.md">Architecture</a> ·
  <a href="docs/engineering.md">Engineering</a>
</p>

---

<a id="what"></a>

## What it is

An agent can drive a real browser, by the names a person sees, and turn that walk into an automated test.

1. **Author once.** The agent clicks Login, types Username, waits for the next page. Binds are labels, not `#txt_visit_date`.
2. **Keep the file.** Versioned JSON. No uids. `compile` checks it. `run` plays it.
3. **Replay for free.** CI runs the same engine. No model. No MCP. Zero tokens.
4. **When it breaks.** The failure names the step and the candidates. An agent can tell a product bug (file a ticket) from a renamed button (update the step). The suite stays cheap.

That is the product. Headed or headless. Live agent or CLI. Same engine.

| You can        | How                                                                              |
| -------------- | -------------------------------------------------------------------------------- |
| See the page   | `observe` returns the a11y snapshot, screenshot, and pixel overlay together      |
| Act by name    | `run_flow` binds `name` / `role` / `near`. Ambiguous labels stop with candidates |
| Wait and check | `watch_until`, `verify`, `explain`, `expectUrl` / `expectText`                   |
| Keep the path  | Versioned JSON. No uids on disk. `compile` then `run`                            |

### Modes

| Mode                 | For                          | How                                      |
| -------------------- | ---------------------------- | ---------------------------------------- |
| **Headed** (default) | Authoring and demos          | Visible Chrome, cursor HUD, paced typing |
| **Headless**         | CI and background            | `BROWSER_AGENT_HEADED=0`                 |
| **MCP stdio**        | A live agent in this process | `npm start`                              |
| **MCP HTTP**         | A remote agent               | `npm start -- --http`                    |
| **CLI compile**      | Check a flow file, no Chrome | `node dist/cli.js compile path.json`     |
| **CLI run**          | Replay a flow                | `node dist/cli.js run path.json`         |

Pace, type delay, expect timeout, and the work-area snap are all env-configurable. See [usage](docs/usage.md).

---

<a id="start"></a>

## Start

Requires Node.js `>= 20.19`.

```bash
git clone https://github.com/PremierStudio/BrowserAgent.git
cd BrowserAgent
npm install
npm run build
```

Replay the checked-in login fixture (headless):

```powershell
$env:BROWSER_AGENT_HEADED='0'
node dist/cli.js compile tests/fixtures/login.flow.json
node dist/cli.js run tests/fixtures/login.flow.json
```

```bash
BROWSER_AGENT_HEADED=0 node dist/cli.js run tests/fixtures/login.flow.json
```

A failure names the step: `step 2 click: no target ...`.

Give an agent the same engine over MCP:

```bash
npm start
```

Point the client at `node dist/cli.js`. Prefer one `run_flow` over observe-per-page. Full tool list, desk controls, and env vars: [usage](docs/usage.md).

---

<a id="flows"></a>

## Flows

Click and navigate must declare `expectUrl` or `expectText`. Type, hover, scroll, select, and press do not.

```json
{
  "version": 1,
  "name": "login",
  "origin": "https://example.com",
  "steps": [
    {
      "action": "navigate",
      "url": "https://example.com/login",
      "expectText": "Username"
    },
    { "action": "type", "name": "Username", "text": "tomsmith" },
    {
      "action": "click",
      "name": "Login",
      "role": "button",
      "expectText": "Logout"
    }
  ]
}
```

Author with `run_flow` until every bind is unique, write the JSON (no uids), then `compile` / `run` in CI.

---

## Docs

| Doc                                  | What is in it                                         |
| ------------------------------------ | ----------------------------------------------------- |
| [Usage](docs/usage.md)               | MCP, desk/page/intent tools, env, public-site demos   |
| [Architecture](docs/architecture.md) | Engine, clients, page model, what is not in this repo |
| [Engineering](docs/engineering.md)   | `npm run ci`, 100/100 gates, stack                    |
| [mvp.md](docs/mvp.md)                | Product plan                                          |
| [decisions.md](docs/decisions.md)    | Amendments (win over mvp.md)                          |

---

## Contributing

[`AGENTS.md`](AGENTS.md) and [`docs/engineering.md`](docs/engineering.md). Failing test first. No merge below 100% coverage and 100% mutation. TypeScript only.

## License

Apache License 2.0 © [Premier Studio](https://github.com/PremierStudio). See [LICENSE](LICENSE).
