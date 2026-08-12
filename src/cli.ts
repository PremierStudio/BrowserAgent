import { serveStdio } from '@modelcontextprotocol/server/stdio'
import puppeteer from 'puppeteer'
import { exposeFunctionFromUnknown, toPageLikeFromUnknown } from './browser/adaptPage.js'
import { createDomMutationBridge, installMutationObserver } from './browser/domMutations.js'
import { adaptPageEventsFromUnknown, combineEventSources } from './browser/pageEvents.js'
import { PuppeteerContextPage } from './context/ContextPage.js'
import { memoryMutationSource } from './context/waitAfterAction.js'
import { buildCliMain, buildHttpHandler } from './protocol/cli.js'
import { isHttpArg, listenHttp } from './protocol/httpListen.js'

const browser = await puppeteer.launch({ headless: true })
const raw = await browser.newPage()
const like = toPageLikeFromUnknown(raw)
const mutations = memoryMutationSource()
const context = new PuppeteerContextPage(like, { mutations })
const bridge = createDomMutationBridge()
await installMutationObserver(
  (script) => like.evaluate(script),
  (name, fn) => exposeFunctionFromUnknown(raw, name, fn),
  (payload) => {
    bridge.ingest(payload)
    mutations.emit()
  },
)
const eventSource = combineEventSources(adaptPageEventsFromUnknown(raw), bridge.source)
const options = { page: context, eventSource }

// The runnable entry point: stdio by default, Streamable HTTP with --http.
if (isHttpArg(process.argv)) {
  const port = Number(process.env.PORT ?? '3333')
  await listenHttp(buildHttpHandler(options), Number.isFinite(port) ? port : 3333)
} else {
  buildCliMain((factory) => serveStdio(factory), options)()
}
