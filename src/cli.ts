import { serveStdio } from '@modelcontextprotocol/server/stdio'
import puppeteer from 'puppeteer'
import { toPageLikeFromUnknown } from './browser/adaptPage.js'
import { createDomMutationBridge, INSTALL_MUTATION_OBSERVER } from './browser/domMutations.js'
import { adaptPageEventsFromUnknown, combineEventSources } from './browser/pageEvents.js'
import { PuppeteerContextPage } from './context/ContextPage.js'
import { buildCliMain, buildHttpHandler } from './protocol/cli.js'
import { isHttpArg, listenHttp } from './protocol/httpListen.js'

const browser = await puppeteer.launch({ headless: true })
const raw = await browser.newPage()
const like = toPageLikeFromUnknown(raw)
await like.evaluate(INSTALL_MUTATION_OBSERVER)
const context = new PuppeteerContextPage(like)
const bridge = createDomMutationBridge()
const eventSource = combineEventSources(adaptPageEventsFromUnknown(raw), bridge.source)
const options = { page: context, eventSource }

// The runnable entry point: stdio by default, Streamable HTTP with --http.
if (isHttpArg(process.argv)) {
  const port = Number(process.env.PORT ?? '3333')
  await listenHttp(buildHttpHandler(options), Number.isFinite(port) ? port : 3333)
} else {
  buildCliMain((factory) => serveStdio(factory), options)()
}
