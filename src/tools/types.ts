import type { z } from 'zod'

/** Categories used to gate which tools are available. */
export const ToolCategory = {
  Observe: 'observe',
  Action: 'action',
  Navigation: 'navigation',
  Intent: 'intent',
} as const

export type ToolCategory = (typeof ToolCategory)[keyof typeof ToolCategory]

/** Context passed to a tool handler at call time. */
export interface ToolContext {
  /** Whether experimental tools are currently enabled. */
  experimental: boolean
  /** The page for page tools; absent for plain tools. */
  page?: unknown
}

/** A registered tool definition. */
export interface ToolDefinition {
  name: string
  description: string
  category: ToolCategory
  experimental: boolean
  readOnly: boolean
  inputSchema: z.ZodType
  handler: (args: unknown, context: ToolContext) => Promise<unknown>
}
