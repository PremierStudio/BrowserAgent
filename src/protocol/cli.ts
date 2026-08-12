import type { McpServer } from '@modelcontextprotocol/server'
import type { StdioServerHandle } from '@modelcontextprotocol/server/stdio'
import { ActionLog } from '../actions/ActionLog.js'
import { EventBuffer } from '../events/EventBuffer.js'
import { TaskRunner } from '../tasks/TaskRunner.js'
import { TaskStore } from '../tasks/TaskStore.js'
import { buildIntentTools } from '../intent/intentTools.js'
import { buildTools } from './buildTools.js'
import { createHttpHandler } from './http.js'
import { createServer } from './server.js'

/** A server factory producing the fully-wired MCP server. */
type ServerFactory = () => McpServer

/** The serve function used to run the server over stdio (injectable for tests). */
export type Serve = (factory: ServerFactory) => StdioServerHandle

const SERVER_NAME = 'browser-agent'
const SERVER_VERSION = '0.0.1'
const EVENT_CAPACITY = 100

/**
 * Builds the fully-wired default server: page tools, confirm_action (MRTR),
 * the Tasks fallback tools, and the browser://events resource.
 */
export function createDefaultServer(): McpServer {
  const store = new TaskStore()
  const runner = new TaskRunner(store)
  const events = new EventBuffer(EVENT_CAPACITY)
  const actions = new ActionLog(EVENT_CAPACITY)
  return createServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      tools: [...buildTools(), ...buildIntentTools()],
      events,
      tasks: { store, runner },
      actions,
    },
  )
}

/**
 * Builds the CLI main function. The serve dependency is injected: the entry
 * point passes the SDK's serveStdio, tests pass a stub. The factory creates
 * the fully-wired server with the standard page-aware tool set.
 */
export function buildCliMain(serve: Serve): () => void {
  return () => {
    serve(() => createDefaultServer())
  }
}

/** Builds the Streamable HTTP handler around the default server factory. */
export function buildHttpHandler() {
  return createHttpHandler(() => createDefaultServer())
}
