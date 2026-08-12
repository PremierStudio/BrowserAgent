import { McpServer } from '@modelcontextprotocol/server'
import type { ToolDefinition } from '../tools/types.js'

/** A minimal structural view of the MCP server we register tools on. */
export interface ToolRegistrar {
  registerTool(
    name: string,
    config: {
      title?: string
      description?: string
      inputSchema?: unknown
      annotations?: Record<string, boolean>
    },
    callback: (args: unknown) => Promise<unknown>,
  ): void
}

/** The subset of ToolHandler that tool registration needs. */
export interface ToolCaller {
  call(name: string, args: unknown): Promise<unknown>
}

/**
 * Maps a tool's read/write nature to MCP Tool Annotations (decision #6).
 * Read-only tools advertise readOnlyHint; write tools advertise
 * destructiveHint. Annotations are untrusted hints to the client.
 */
export function toToolAnnotations(readOnly: boolean): Record<string, boolean> {
  return readOnly ? { readOnlyHint: true } : { destructiveHint: true }
}

/**
 * Registers every tool from a ToolCaller onto an MCP server. Each tool's
 * zod input schema and annotations are passed through; the callback dispatches
 * to the ToolCaller, which enforces gating and the write mutex.
 */
export function registerTools(
  server: ToolRegistrar,
  tools: ToolDefinition[],
  handler: ToolCaller,
): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: toToolAnnotations(tool.readOnly),
      },
      async (args) => handler.call(tool.name, args),
    )
  }
}

/** Creates an MCP server with the given implementation info. */
export function initServer(name: string, version: string): McpServer {
  return new McpServer({ name, version })
}
