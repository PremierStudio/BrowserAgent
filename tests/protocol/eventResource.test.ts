import { describe, expect, it } from 'vitest'
import { McpServer, InMemoryTransport } from '@modelcontextprotocol/server'
import { EventBuffer } from '../../src/events/EventBuffer.js'
import {
  createEventResource,
  toResourceContents,
  EVENT_RESOURCE_CONFIG,
} from '../../src/protocol/eventResource.js'

function consoleEvent(
  text: string,
  timestamp: number,
): {
  type: 'console'
  timestamp: number
  level: 'log'
  text: string
} {
  return { type: 'console', timestamp, level: 'log', text }
}

describe('toResourceContents', () => {
  it('serializes events into resource text contents', () => {
    const buffer = new EventBuffer(10)
    buffer.push(consoleEvent('hello', 1))
    const contents = toResourceContents(buffer)
    expect(contents).toEqual([
      {
        uri: 'browser://events',
        mimeType: 'application/json',
        text: JSON.stringify([{ type: 'console', timestamp: 1, level: 'log', text: 'hello' }]),
      },
    ])
  })

  it('returns an empty list for an empty buffer', () => {
    expect(toResourceContents(new EventBuffer(10))).toEqual([])
  })
})

describe('createEventResource', () => {
  it('registers the resource with a JSON mime type', () => {
    expect(EVENT_RESOURCE_CONFIG.mimeType).toBe('application/json')
  })

  it('registers the resource and notifies on new events', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' })
    const buffer = new EventBuffer(10)
    const resource = createEventResource(server, buffer, 'browser://events')
    const notified: string[] = []
    const original = server.server.sendResourceUpdated.bind(server.server)
    server.server.sendResourceUpdated = (params: { uri: string }) => {
      notified.push(params.uri)
      return original(params)
    }
    const [serverTransport] = InMemoryTransport.createLinkedPair()
    await server.connect(serverTransport)

    // No events yet, so no notification.
    resource.check()
    expect(notified).toEqual([])

    // New events arrive; check() notifies once.
    buffer.push(consoleEvent('a', 1))
    buffer.push(consoleEvent('b', 2))
    resource.check()
    expect(notified).toEqual(['browser://events'])

    // No new events since the last check.
    resource.check()
    expect(notified).toEqual(['browser://events'])
    await server.close()
  })

  it('notifies again when more events arrive after a check', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' })
    const buffer = new EventBuffer(10)
    const resource = createEventResource(server, buffer, 'browser://events')
    const notified: string[] = []
    const original = server.server.sendResourceUpdated.bind(server.server)
    server.server.sendResourceUpdated = (params: { uri: string }) => {
      notified.push(params.uri)
      return original(params)
    }
    const [serverTransport] = InMemoryTransport.createLinkedPair()
    await server.connect(serverTransport)

    buffer.push(consoleEvent('a', 1))
    resource.check()
    buffer.push(consoleEvent('b', 2))
    resource.check()
    expect(notified).toEqual(['browser://events', 'browser://events'])
    await server.close()
  })

  it('serves the event buffer through a resources/read request', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' })
    const buffer = new EventBuffer(10)
    buffer.push(consoleEvent('a', 1))
    createEventResource(server, buffer, 'browser://events')
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair()
    await server.connect(serverTransport)
    await clientTransport.start()

    const responses: unknown[] = []
    clientTransport.onmessage = (message) => {
      responses.push(message)
    }
    await clientTransport.send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2026-07-28',
        capabilities: {},
        clientInfo: { name: 'test', version: '0.0.1' },
      },
    })
    await clientTransport.send({ jsonrpc: '2.0', method: 'notifications/initialized' })
    await clientTransport.send({
      jsonrpc: '2.0',
      id: 2,
      method: 'resources/list',
      params: {},
    })
    await clientTransport.send({
      jsonrpc: '2.0',
      id: 3,
      method: 'resources/read',
      params: { uri: 'browser://events' },
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(responses.length).toBeGreaterThan(0)
    const listed = responses.find(
      (message) =>
        typeof message === 'object' && message !== null && 'id' in message && message.id === 2,
    )
    const read = responses.find(
      (message) =>
        typeof message === 'object' && message !== null && 'id' in message && message.id === 3,
    )
    expect(listed).toMatchObject({
      result: {
        resources: [
          { uri: 'browser://events', name: 'browser-events', mimeType: 'application/json' },
        ],
      },
    })
    expect(read).toMatchObject({
      result: {
        contents: [
          {
            uri: 'browser://events',
            mimeType: 'application/json',
            text: JSON.stringify([{ type: 'console', timestamp: 1, level: 'log', text: 'a' }]),
          },
        ],
      },
    })
    await server.close()
  })
})
