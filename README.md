<p align="center">
  <img alt="BrowserAgent" src="https://raw.githubusercontent.com/PremierStudio/BrowserAgent/master/docs/banner.svg" width="90%"/>
</p>

<p align="center">
  Turn one agent walkthrough into a CI test that runs with no AI.
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

You can already ask an agent to click through a checkout. That works **once**. The next morning you want the same path on every commit, without paying for another model call, and without a test that dies the first time a designer changes a CSS id.

Today that usually means one of two dead ends:

- **Chat browsers (most MCP tools).** The agent looks at the page, clicks, and talks to you. Tomorrow you run the agent again. Every replay spends tokens. The path lives in a transcript, not in CI.
- **Recorders (Playwright codegen, Selenium IDE, and friends).** You get `#txt_visit_date` and `.btn-primary`. The next rename breaks the test. The log does not say "Login is gone." It says a selector missed. A person has to debug CSS.

BrowserAgent is the middle path.

The agent drives a real Chrome window and refers to controls the way a person would: "Username", "Login", "the Add to cart near Sauce Labs Backpack." Those **visible names** are what get saved, as ordinary JSON. CI then opens Chrome and follows the same names. No language model is in that run. No MCP session is required. The bill is the same as any other headless test.

When a step fails, the report is in the same language: "step 2 click Login: two matches" or "no control named Login." An agent (or a person) can tell the difference between **the product broke** (open a ticket) and **the button is now called Sign in** (change one line in the file). The suite stays cheap because only the broken step needs a model, and only if you want one.

That is what this repo is for: author with an agent, keep a file, replay without one. Headed while you watch, headless in CI. Same engine.

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
