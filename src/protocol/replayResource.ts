import { McpServer } from '@modelcontextprotocol/server'
import type { ActionLog } from '../actions/ActionLog.js'
import { renderReplay } from '../apps/replay.js'
import type { ResourceContent } from './eventResource.js'

/** The MCP Apps replay resource config (decision #5). */
export const REPLAY_RESOURCE_CONFIG = { mimeType: 'text/html;profile=mcp-app' } as const

const DEFAULT_URI = 'ui://browser-agent/replay'

/** Serializes the action log into a ui:// HTML resource. */
export function toReplayContents(log: ActionLog, uri: string = DEFAULT_URI): ResourceContent[] {
  return [
    {
      uri,
      mimeType: REPLAY_RESOURCE_CONFIG.mimeType,
      text: renderReplay(log.all()),
    },
  ]
}

/**
 * Registers the MCP Apps replay resource. Hosts that understand
 * `ui://` + `text/html;profile=mcp-app` can render the action log.
 */
export function createReplayResource(
  server: McpServer,
  log: ActionLog,
  uri: string,
): { read: () => Promise<{ contents: ResourceContent[] }> } {
  const read = async (): Promise<{ contents: ResourceContent[] }> => ({
    contents: toReplayContents(log, uri),
  })
  server.registerResource('browser-replay', uri, REPLAY_RESOURCE_CONFIG, read)
  return { read }
}
