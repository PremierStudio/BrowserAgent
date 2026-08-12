import type { ToolDefinition, ToolContext } from './types.js'
import { z } from 'zod'
import { ToolMutex } from './ToolMutex.js'

/**
 * Owns a set of registered tools and enforces the gating rules: category
 * gating, experimental-flag gating, unknown-argument rejection, and a global
 * write mutex (read-only tools may run concurrently; writes are serialized).
 */
export class ToolHandler {
  private tools = new Map<string, ToolDefinition>()
  private disabledCategories = new Set<string>()
  private experimentalEnabled = false
  private mutex = new ToolMutex()
  private writeTail: Promise<void> = Promise.resolve()

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()]
  }

  setCategoryEnabled(category: string, enabled: boolean): void {
    if (enabled) {
      this.disabledCategories.delete(category)
    } else {
      this.disabledCategories.add(category)
    }
  }

  setExperimentalEnabled(enabled: boolean): void {
    this.experimentalEnabled = enabled
  }

  async call(name: string, rawArgs: unknown): Promise<unknown> {
    const tool = this.tools.get(name)
    if (tool === undefined) {
      throw new Error(`Unknown tool: ${name}`)
    }
    if (this.disabledCategories.has(tool.category)) {
      throw new Error(`Tool "${name}" is in a disabled category: ${tool.category}`)
    }
    if (tool.experimental && !this.experimentalEnabled) {
      throw new Error(`Tool "${name}" is experimental and experimental tools are disabled`)
    }

    const args = this.parseArgs(tool, rawArgs)
    const context: ToolContext = { experimental: this.experimentalEnabled }

    if (tool.readOnly) {
      const token = this.mutex.acquireRead()
      if (token === null) {
        throw new Error(`Tool "${name}" could not acquire the read lock`)
      }
      try {
        return await tool.handler(args, context)
      } finally {
        this.mutex.releaseRead(token)
      }
    }

    return this.runWrite(() => tool.handler(args, context))
  }

  /** Serializes write tools: each waits for the previous write to finish. */
  private runWrite<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.writeTail
    let release: () => void
    this.writeTail = new Promise<void>((resolve) => {
      release = resolve
    })
    return previous
      .then(async () => {
        if (!this.mutex.acquireWrite()) {
          throw new Error('Could not acquire the write lock')
        }
        try {
          return await fn()
        } finally {
          this.mutex.releaseWrite()
        }
      })
      .finally(() => release())
  }

  private parseArgs(tool: ToolDefinition, rawArgs: unknown): unknown {
    const schema = this.strictSchema(tool.inputSchema)
    const parsed = schema.safeParse(rawArgs)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for tool "${tool.name}": ${parsed.error.message}`)
    }
    return parsed.data
  }

  /** Rejects unknown keys by parsing with a strict object schema when possible. */
  private strictSchema(schema: ToolDefinition['inputSchema']): ToolDefinition['inputSchema'] {
    if (schema instanceof z.ZodObject) {
      return schema.strict()
    }
    return schema
  }
}
