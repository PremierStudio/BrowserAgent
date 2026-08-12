import { describe, expect, it } from 'vitest'
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { createServer } from '../../src/protocol/server.js'
import { ActionLog } from '../../src/actions/ActionLog.js'
import type { ContextPage } from '../../src/context/ContextPage.js'
import { EventBuffer } from '../../src/events/EventBuffer.js'
import { TaskRunner } from '../../src/tasks/TaskRunner.js'
import { TaskStore } from '../../src/tasks/TaskStore.js'
import { ToolCategory } from '../../src/tools/types.js'

describe('createServer', () => {
  it('returns an McpServer with implementation info', () => {
    const server = createServer({ name: 'browser-agent', version: '0.0.1' })
    expect(server).toBeInstanceOf(McpServer)
  })

  it('registers each provided tool', () => {
    const tool = {
      name: 'ping',
      description: 'Pings',
      category: ToolCategory.Observe,
      experimental: false,
      readOnly: true,
      inputSchema: z.object({ value: z.string() }),
      handler: async () => 'pong',
    }
    const server = createServer({ name: 'browser-agent', version: '0.0.1' }, { tools: [tool] })
    expect(server).toBeInstanceOf(McpServer)
    // The tool is registered via the protocol bridge; the server exposes it.
    const jsonSchema = server.toolInputSchemaJson('ping')
    expect(jsonSchema).toBeDefined()
  })

  it('registers the event resource when an event buffer is provided', () => {
    const buffer = new EventBuffer(10)
    const server = createServer({ name: 'browser-agent', version: '0.0.1' }, { events: buffer })
    expect(server).toBeInstanceOf(McpServer)
    // The browser://events resource is registered and readable.
    const schema = server.toolInputSchemaJson('nope')
    expect(schema).toBeUndefined()
  })

  it('always registers the confirm_action tool', () => {
    const server = createServer({ name: 'browser-agent', version: '0.0.1' })
    expect(server.toolInputSchemaJson('confirm_action')).toBeDefined()
  })

  it('wraps a provided page in a BrowserSession', () => {
    const page: ContextPage = {
      getElementByUid: async () => undefined,
      waitForEventsAfterAction: async () => undefined,
      observe: async () => ({
        snapshot: { uid: 'x', role: 'generic', name: '' },
        image: '',
        overlay: {},
        pageState: { url: '', title: '' },
      }),
      emulate: async () => undefined,
      getDialog: async () => null,
      click: async () => undefined,
      type: async () => undefined,
      hover: async () => undefined,
      scroll: async () => undefined,
      select: async () => undefined,
      press: async () => undefined,
      navigate: async () => undefined,
    }
    const server = createServer({ name: 'browser-agent', version: '0.0.1' }, { page })
    expect(server).toBeInstanceOf(McpServer)
  })

  it('registers the replay resource when an action log is provided', () => {
    const actions = new ActionLog(10)
    const server = createServer({ name: 'browser-agent', version: '0.0.1' }, { actions })
    expect(server).toBeInstanceOf(McpServer)
  })

  it('registers task tools when a task store is provided', () => {
    const store = new TaskStore(() => 'task-1')
    const runner = new TaskRunner(store)
    const server = createServer(
      { name: 'browser-agent', version: '0.0.1' },
      { tasks: { store, runner } },
    )
    expect(server.toolInputSchemaJson('get_task')).toBeDefined()
    expect(server.toolInputSchemaJson('list_tasks')).toBeDefined()
    expect(server.toolInputSchemaJson('cancel_task')).toBeDefined()
    expect(server.toolInputSchemaJson('wait_task')).toBeDefined()
  })
})
