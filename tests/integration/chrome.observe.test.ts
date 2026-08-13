// Enable with BROWSER_ENGINE_INTEGRATION=1
// Windows PowerShell: $env:BROWSER_ENGINE_INTEGRATION=1
// then: npx vitest run tests/integration
import type { Browser } from 'puppeteer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { toPageLikeFromUnknown } from '../../src/browser/adaptPage.js'
import { PuppeteerContextPage } from '../../src/context/ContextPage.js'
import { startLocalHtmlServer } from '../../src/testing/localHtmlServer.js'
import { firstClickableUid, findSnapshotNode, OBSERVE_BUTTON_HTML } from './helpers.js'

const enabled = process.env.BROWSER_ENGINE_INTEGRATION === '1'

describe.skipIf(!enabled)('chrome observe', () => {
  let server: Awaited<ReturnType<typeof startLocalHtmlServer>> | undefined
  let browser: Browser | undefined
  let launchError: string | undefined

  beforeAll(async () => {
    server = await startLocalHtmlServer(OBSERVE_BUTTON_HTML)
    try {
      const puppeteer = (await import('puppeteer')).default
      browser = await puppeteer.launch({ headless: true, timeout: 15000 })
    } catch (error) {
      launchError = error instanceof Error ? error.message : 'puppeteer.launch failed'
    }
  }, 30000)

  afterAll(async () => {
    if (browser !== undefined) {
      await browser.close()
    }
    if (server !== undefined) {
      await server.close()
    }
  }, 15000)

  it('observes a local button page and clicks a uid when one exists', async (ctx) => {
    if (browser === undefined) {
      ctx.skip(launchError ?? 'puppeteer.launch failed')
      return
    }
    if (server === undefined) {
      ctx.skip('local HTML server did not start')
      return
    }
    const page = await browser.newPage()
    await page.goto(server.url)
    const context = new PuppeteerContextPage(toPageLikeFromUnknown(page))
    const result = await context.observe()
    expect(result.image.length).toBeGreaterThan(0)
    expect(typeof result.snapshot.role).toBe('string')
    const go = findSnapshotNode(result.snapshot, 'button', 'Go')
    if (go !== undefined) {
      expect(go.role).toBe('button')
      expect(go.name).toBe('Go')
    }
    const uid = firstClickableUid(result.snapshot)
    if (uid !== undefined) {
      await context.click(uid)
    }
  }, 30000)
})
