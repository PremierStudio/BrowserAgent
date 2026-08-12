import {
  isInputRequiredResult,
  McpServer,
  type CallToolResult,
  type InputRequiredResult,
} from '@modelcontextprotocol/server'
import type { ToolDefinition } from '../tools/types.js'

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
 * Wraps a tool handler result as an MCP CallToolResult. InputRequiredResult
 * (MRTR, decision #4) is returned unchanged so the host can run elicitation.
 */
export function toCallToolResult(result: unknown): CallToolResult | InputRequiredResult {
  if (isInputRequiredResult(result)) {
    return result
  }
  const wrapped: CallToolResult = {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    structuredContent: isStructured(result) ? result : { value: result },
  }
  return wrapped
}

function isStructured(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Registers every tool from a ToolCaller onto an MCP server. Each tool's
 * zod input schema and annotations are passed through; the callback dispatches
 * to the ToolCaller (which enforces gating and the write mutex) and wraps the
 * result into an MCP CallToolResult with structuredContent plus a text
 * representation.
 */
export function registerTools(
  server: McpServer,
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
      async (args) => {
        const result = await handler.call(tool.name, args)
        return toCallToolResult(result)
      },
    )
  }
}

/** Creates an MCP server with the given implementation info. */
export function initServer(name: string, version: string): McpServer {
  return new McpServer({ name, version })
}
