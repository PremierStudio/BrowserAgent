import { createMcpHandler, type McpServer } from '@modelcontextprotocol/server'

/** A factory that produces a fresh MCP server for one HTTP serving unit. */
type HttpServerFactory = () => McpServer

/**
 * Builds a Streamable HTTP handler (decision #1 / M5) around a server
 * factory. Hosts serve this via `handler.fetch(request)`.
 */
export function createHttpHandler(factory: HttpServerFactory) {
  return createMcpHandler(() => factory())
}
