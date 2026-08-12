// Enable with BROWSER_AGENT_INTEGRATION=1
import type { Browser } from 'puppeteer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { toPageLikeFromUnknown } from '../../src/browser/adaptPage.js'
import { PuppeteerContextPage } from '../../src/context/ContextPage.js'
import { BrowserSession } from '../../src/session/BrowserSession.js'
import { startLocalHtmlServer } from '../../src/testing/localHtmlServer.js'
import { firstClickableUid, findSnapshotNode } from './helpers.js'

const enabled = process.env.BROWSER_AGENT_INTEGRATION === '1'

const SPIN_HTML = `<!doctype html>
<html lang="en">
<head><title>Spin</title></head>
<body>
  <h1>BrowserAgent spin</h1>
  <button id="go">Go</button>
  <p id="out">idle</p>
  <script>
    document.getElementById('go').addEventListener('click', function () {
      document.getElementById('out').textContent = 'clicked'
    })
  </script>
</body>
</html>`

function mark(label: string, started: number): { label: string; ms: number } {
  return { label, ms: Date.now() - started }
}

describe.skipIf(!enabled)('chrome spin', () => {
  let server: Awaited<ReturnType<typeof startLocalHtmlServer>> | undefined
  let browser: Browser | undefined
  let launchError: string | undefined

  beforeAll(async () => {
    server = await startLocalHtmlServer(SPIN_HTML)
    try {
      const puppeteer = (await import('puppeteer')).default
      browser = await puppeteer.launch({ headless: true, timeout: 20000 })
    } catch (error) {
      launchError = error instanceof Error ? error.message : 'puppeteer.launch failed'
    }
  }, 40000)

  afterAll(async () => {
    if (browser !== undefined) {
      await browser.close()
    }
    if (server !== undefined) {
      await server.close()
    }
  }, 15000)

  it('times launch, navigate, observe, click, and a second observe', async (ctx) => {
    if (browser === undefined) {
      ctx.skip(launchError ?? 'puppeteer.launch failed')
      return
    }
    if (server === undefined) {
      ctx.skip('local HTML server did not start')
      return
    }

    const timings: { label: string; ms: number }[] = []
    let t = Date.now()
    const page = await browser.newPage()
    timings.push(mark('newPage', t))

    t = Date.now()
    await page.goto(server.url)
    timings.push(mark('goto', t))

    const context = new PuppeteerContextPage(toPageLikeFromUnknown(page))
    const session = new BrowserSession(context)

    t = Date.now()
    const first = await session.observe()
    timings.push(mark('observe1', t))

    expect(first.image.length).toBeGreaterThan(20)
    expect(first.pageState.title).toBe('Spin')
    expect(first.diff).toEqual({ added: [], removed: [], changed: [] })
    const go = findSnapshotNode(first.snapshot, 'button', 'Go')
    expect(go).toBeDefined()
    const uid = firstClickableUid(first.snapshot)
    expect(uid).toBeDefined()
    if (uid === undefined) {
      return
    }

    t = Date.now()
    await session.click(uid)
    timings.push(mark('click', t))

    t = Date.now()
    const second = await session.observe()
    timings.push(mark('observe2', t))

    const out = findSnapshotNode(second.snapshot, 'generic', 'clicked')
    const outAlt = findSnapshotNode(second.snapshot, 'paragraph', 'clicked')
    expect(out !== undefined || outAlt !== undefined || second.diff.changed.length > 0).toBe(true)

    const report = timings.map((row) => `${row.label}=${row.ms}ms`).join(' ')
    expect(report.length).toBeGreaterThan(0)
    console.log(`SPIN ${report} title=${second.pageState.title} uid=${uid}`)
  }, 40000)
})
