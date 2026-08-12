import type { McpServer } from '@modelcontextprotocol/server'
import type { StdioServerHandle } from '@modelcontextprotocol/server/stdio'
import { buildTools } from './buildTools.js'
import { createServer } from './server.js'

/** A server factory producing the fully-wired MCP server. */
type ServerFactory = () => McpServer

/** The serve function used to run the server over stdio (injectable for tests). */
export type Serve = (factory: ServerFactory) => StdioServerHandle

const SERVER_NAME = 'browser-agent'
const SERVER_VERSION = '0.0.1'

/**
 * Builds the CLI main function. The serve dependency is injected: the entry
 * point passes the SDK's serveStdio, tests pass a stub. The factory creates
 * the fully-wired server with the standard page-aware tool set.
 */
export function buildCliMain(serve: Serve): () => void {
  return () => {
    serve(() => createServer({ name: SERVER_NAME, version: SERVER_VERSION }, buildTools()))
  }
}
