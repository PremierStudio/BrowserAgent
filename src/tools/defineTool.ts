import type { z } from 'zod'
import type { ToolCategory, ToolContext, ToolDefinition } from './types.js'

interface DefineToolOptions {
  name: string
  description: string
  category: ToolCategory
  inputSchema: z.ZodType
  experimental?: boolean
  readOnly?: boolean
  handler: (args: unknown, context: ToolContext) => Promise<unknown>
}

/** Builds a plain tool definition with sensible defaults. */
export function defineTool(options: DefineToolOptions): ToolDefinition {
  return {
    name: options.name,
    description: options.description,
    category: options.category,
    experimental: options.experimental ?? false,
    readOnly: options.readOnly ?? false,
    inputSchema: options.inputSchema,
    handler: options.handler,
  }
}

interface DefinePageToolOptions extends Omit<DefineToolOptions, 'handler'> {
  handler: (args: unknown, context: ToolContext, page: unknown) => Promise<unknown>
}

/** Builds a tool definition that requires a page in its context. */
export function definePageTool(options: DefinePageToolOptions): ToolDefinition {
  return defineTool({
    ...options,
    handler: async (args, context) => {
      if (context.page === undefined) {
        throw new Error(`Tool "${options.name}" requires a page`)
      }
      return options.handler(args, context, context.page)
    },
  })
}
