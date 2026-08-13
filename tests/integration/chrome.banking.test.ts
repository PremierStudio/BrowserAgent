// Enable with BROWSER_ENGINE_SHOWCASE=1 (headed, public XYZ Bank)
import type { Browser } from 'puppeteer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { toPageLikeFromUnknown } from '../../src/browser/adaptPage.js'
import { firstBrowserPage, puppeteerLaunchOptions } from '../../src/browser/launchOptions.js'
import { typeCharMs } from '../../src/context/actOnPage.js'
import { PuppeteerContextPage } from '../../src/context/ContextPage.js'
import { BANKING_STEPS } from '../../src/intent/bankingFlow.js'
import { DEFAULT_EXPECT_TIMEOUT_MS, HUMAN_PACE_MS, runFlow } from '../../src/intent/runFlow.js'
import { defaultClock, defaultSleep } from '../../src/intent/watchUntil.js'

const enabled = process.env.BROWSER_ENGINE_SHOWCASE === '1'

describe.skipIf(!enabled)('chrome banking', () => {
  let browser: Browser | undefined
  let launchError: string | undefined

  beforeAll(async () => {
    try {
      const puppeteer = (await import('puppeteer')).default
      browser = await puppeteer.launch(puppeteerLaunchOptions(true))
    } catch (error) {
      launchError = error instanceof Error ? error.message : 'puppeteer.launch failed'
    }
  }, 40000)

  afterAll(async () => {
    if (browser !== undefined) {
      await browser.close()
    }
  }, 15000)

  it('deposits 150 as Harry Potter in one run_flow', async (ctx) => {
    if (browser === undefined) {
      ctx.skip(launchError ?? 'puppeteer.launch failed')
      return
    }
    const launched = browser
    const raw = await firstBrowserPage(
      () => launched.pages(),
      () => launched.newPage(),
    )
    const context = new PuppeteerContextPage(toPageLikeFromUnknown(raw), {
      sleep: defaultSleep,
      typeCharMs: typeCharMs({ BROWSER_ENGINE_HEADED: '1' }),
    })
    const result = await runFlow(context, [...BANKING_STEPS], {
      paceMs: HUMAN_PACE_MS,
      expectTimeoutMs: DEFAULT_EXPECT_TIMEOUT_MS,
      sleep: defaultSleep,
      clock: defaultClock,
    })
    expect(result.ok).toBe(true)
    expect(result.steps).toBe(BANKING_STEPS.length)
    const end = await context.observe()
    expect(end.pageState.url).toMatch(/\/account/)
    expect(end.pageState.title).toMatch(/XYZ Bank/i)
  }, 120000)
})
