import { z } from 'zod'
import { defineTool } from '../tools/defineTool.js'
import { ToolCategory } from '../tools/types.js'
import type { ToolDefinition } from '../tools/types.js'
import { confirmGate, isConfirmed } from './mrtr.js'

function isConfirmArgs(args: unknown): args is {
  message: string
  requestState?: string
  responses?: unknown
} {
  return typeof args === 'object' && args !== null && 'message' in args
}

/** Human-in-the-loop confirmation tool (MRTR, decision #4). */
export function buildConfirmTool(): ToolDefinition {
  return defineTool({
    name: 'confirm_action',
    description: 'Ask the user to confirm a potentially destructive action.',
    category: ToolCategory.Action,
    inputSchema: z.object({
      message: z.string(),
      requestState: z.string().optional(),
      responses: z.unknown().optional(),
    }),
    handler: async (args) => {
      if (!isConfirmArgs(args)) {
        throw new Error('invalid args')
      }
      if (isConfirmed(args.responses)) {
        return { ok: true, confirmed: true }
      }
      return confirmGate(args.message, args.requestState ?? args.message)
    },
  })
}
