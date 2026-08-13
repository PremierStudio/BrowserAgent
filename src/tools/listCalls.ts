import { z } from 'zod'
import { defineTool } from './defineTool.js'
import { ToolCategory } from './types.js'
import type { ToolDefinition } from './types.js'
import type { CallLog } from './callTrace.js'

/** Read-only view of MCP tool timings for this server process. */
export function buildListCallsTool(log: CallLog): ToolDefinition {
  return defineTool({
    name: 'list_calls',
    description: 'List recent MCP tool calls with durationMs and resultBytes.',
    category: ToolCategory.Observe,
    readOnly: true,
    inputSchema: z.object({}),
    handler: async () => ({ calls: log.all() }),
  })
}
