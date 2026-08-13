// Enable with BROWSER_AGENT_INTEGRATION=1
import type { Browser } from 'puppeteer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { toPageLikeFromUnknown } from '../../src/browser/adaptPage.js'
import { PuppeteerContextPage } from '../../src/context/ContextPage.js'
import { saveFlow } from '../../src/intent/flowFile.js'
import { runFlowFile } from '../../src/intent/runFlowFile.js'
import { startLocalHtmlServer } from '../../src/testing/localHtmlServer.js'
import { executeFlowCli } from '../../src/protocol/flowCli.js'

const enabled = process.env.BROWSER_AGENT_INTEGRATION === '1'

const FLOW_HTML =
  '<!doctype html><html lang="en"><head><title>Start</title></head><body>' +
  '<h1>Start</h1><button type="button" id="go">Go</button>' +
  '<script>document.getElementById("go").addEventListener("click",function(){' +
  'document.title="Done";document.querySelector("h1").textContent="Done";});</script>' +
  '</body></html>'

describe.skipIf(!enabled)('chrome flow file', () => {
  let server: Awaited<ReturnType<typeof startLocalHtmlServer>> | undefined
  let browser: Browser | undefined
  let launchError: string | undefined

  beforeAll(async () => {
    server = await startLocalHtmlServer(FLOW_HTML)
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

  it('compiles then runs a saved click flow against local HTML', async (ctx) => {
    if (browser === undefined) {
      ctx.skip(launchError ?? 'puppeteer.launch failed')
      return
    }
    if (server === undefined) {
      ctx.skip('local HTML server did not start')
      return
    }
    const saved = saveFlow({
      name: 'click-go',
      origin: server.url,
      steps: [
        { action: 'navigate', url: server.url, expectText: 'Start' },
        { action: 'click', name: 'Go', expectText: 'Done' },
      ],
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) {
      return
    }
    const compiled: string[] = []
    const compileCode = await executeFlowCli(
      { kind: 'compile', path: 'click-go.json' },
      {
        readFile: () => JSON.stringify(saved.file),
        writeOut: (line) => {
          compiled.push(line)
        },
        writeErr: () => undefined,
      },
    )
    expect(compileCode).toBe(0)
    expect(compiled.join('\n')).toMatch(/ok compile name=click-go steps=2/)

    const page = await browser.newPage()
    const context = new PuppeteerContextPage(toPageLikeFromUnknown(page))
    const result = await runFlowFile(context, saved.file)
    expect(result).toEqual({ ok: true, name: 'click-go', steps: 2 })
    expect(await page.title()).toBe('Done')
  }, 30000)
})
