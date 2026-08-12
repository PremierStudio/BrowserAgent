import { serveStdio } from '@modelcontextprotocol/server/stdio'
import puppeteer from 'puppeteer'
import { toPageLikeFromUnknown } from './browser/adaptPage.js'
import { adaptPageEventsFromUnknown } from './browser/pageEvents.js'
import { PuppeteerContextPage } from './context/ContextPage.js'
import { buildCliMain } from './protocol/cli.js'

const browser = await puppeteer.launch({ headless: true })
const raw = await browser.newPage()

// The runnable entry point: serve the BrowserAgent MCP server over stdio,
// backed by a live headless Chrome.
buildCliMain((factory) => serveStdio(factory), {
  page: new PuppeteerContextPage(toPageLikeFromUnknown(raw)),
  eventSource: adaptPageEventsFromUnknown(raw),
})()
