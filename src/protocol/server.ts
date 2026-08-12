import { McpServer, type ServerOptions } from '@modelcontextprotocol/server'
import { ToolHandler } from '../tools/ToolHandler.js'
import type { ToolDefinition } from '../tools/types.js'
import type { EventBuffer } from '../events/EventBuffer.js'
import { createEventResource } from './eventResource.js'
import { registerTools } from './tools.js'

/** The implementation info for the MCP server. */
export interface ServerInfo {
  name: string
  version: string
}

/** Options for wiring browser services into the server. */
export interface ServerWiring {
  tools?: ToolDefinition[]
  events?: EventBuffer
}

/**
 * Builds a fully-wired MCP server: creates a ToolHandler, registers the
 * provided tool definitions, and bridges them onto an McpServer via the
 * protocol layer. When an event buffer is provided, a browser://events
 * subscription resource is registered (decision #3). This is the composition
 * root for the runnable server.
 */
export function createServer(
  info: ServerInfo,
  wiring: ServerWiring = {},
  options?: ServerOptions,
): McpServer {
  const server = new McpServer(info, options)
  const handler = new ToolHandler()
  for (const tool of wiring.tools ?? []) {
    handler.register(tool)
  }
  registerTools(server, wiring.tools ?? [], handler)
  if (wiring.events !== undefined) {
    createEventResource(server, wiring.events, 'browser://events')
  }
  return server
}
