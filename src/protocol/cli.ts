import type { McpServer } from '@modelcontextprotocol/server'
import type { StdioServerHandle } from '@modelcontextprotocol/server/stdio'
import { buildIntentTools } from '../intent/intentTools.js'
import { createRuntime, type RuntimeOptions } from '../session/runtime.js'
import { buildTools } from './buildTools.js'
import { createHttpHandler } from './http.js'
import { createServer } from './server.js'

/** A server factory producing the fully-wired MCP server. */
type ServerFactory = () => McpServer

/** The serve function used to run the server over stdio (injectable for tests). */
export type Serve = (factory: ServerFactory) => StdioServerHandle

const SERVER_NAME = 'browser-agent'
const SERVER_VERSION = '0.0.1'

/** Optional page and event source for the default server. */
export type DefaultServerOptions = RuntimeOptions

/**
 * Builds the fully-wired default server: page tools, confirm_action (MRTR),
 * the Tasks fallback tools, and the browser://events resource. When a page
 * is provided it is wrapped in a BrowserSession; when an event source is
 * provided, EventCollector starts immediately.
 */
export function createDefaultServer(options: DefaultServerOptions = {}): McpServer {
  const runtime = createRuntime(options)
  return createServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      tools: [...buildTools(), ...buildIntentTools()],
      events: runtime.events,
      tasks: { store: runtime.store, runner: runtime.runner },
      actions: runtime.actions,
      page: runtime.page,
    },
  )
}

/**
 * Builds the CLI main function. The serve dependency is injected: the entry
 * point passes the SDK's serveStdio, tests pass a stub. The factory creates
 * the fully-wired server with the standard page-aware tool set.
 */
export function buildCliMain(serve: Serve, options: DefaultServerOptions = {}): () => void {
  return () => {
    serve(() => createDefaultServer(options))
  }
}

/** Builds the Streamable HTTP handler around the default server factory. */
export function buildHttpHandler(options: DefaultServerOptions = {}) {
  return createHttpHandler(() => createDefaultServer(options))
}
