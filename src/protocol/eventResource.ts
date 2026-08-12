import { McpServer } from '@modelcontextprotocol/server'
import type { EventBuffer } from '../events/EventBuffer.js'

/** A single resource content block. */
export interface ResourceContent {
  uri: string
  mimeType: string
  text: string
}

const EVENT_URI_PREFIX = 'browser://events'

/** Serializes the event buffer into resource content blocks (JSON text). */
export function toResourceContents(buffer: EventBuffer): ResourceContent[] {
  const events = buffer.all()
  if (events.length === 0) {
    return []
  }
  return [
    {
      uri: EVENT_URI_PREFIX,
      mimeType: 'application/json',
      text: JSON.stringify(events),
    },
  ]
}

/**
 * Wires the event layer to MCP subscriptions (decision #3): registers a
 * browser://events resource whose read returns the event buffer contents, and
 * exposes a check() that sends notifications/resources/updated when new events
 * have arrived since the last check. Callers poll check() on a timer or after
 * actions.
 */
export function createEventResource(
  server: McpServer,
  buffer: EventBuffer,
  uri: string,
): {
  check: () => void
} {
  let seen = buffer.all().length
  server.registerResource('browser-events', uri, { mimeType: 'application/json' }, async () => ({
    contents: toResourceContents(buffer),
  }))
  return {
    check(): void {
      const count = buffer.all().length
      if (count > seen) {
        seen = count
        server.server.sendResourceUpdated({ uri })
      }
    },
  }
}
