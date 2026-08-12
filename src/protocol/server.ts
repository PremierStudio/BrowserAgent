import { McpServer, type ServerOptions } from '@modelcontextprotocol/server'
import { ToolHandler } from '../tools/ToolHandler.js'
import type { ToolDefinition } from '../tools/types.js'
import { registerTools } from './tools.js'

/** The implementation info for the MCP server. */
export interface ServerInfo {
  name: string
  version: string
}

/**
 * Builds a fully-wired MCP server: creates a ToolHandler, registers the
 * provided tool definitions, and bridges them onto an McpServer via the
 * protocol layer. This is the composition root for the runnable server.
 */
export function createServer(
  info: ServerInfo,
  tools: ToolDefinition[],
  options?: ServerOptions,
): McpServer {
  const server = new McpServer(info, options)
  const handler = new ToolHandler()
  for (const tool of tools) {
    handler.register(tool)
  }
  registerTools(server, tools, handler)
  return server
}
