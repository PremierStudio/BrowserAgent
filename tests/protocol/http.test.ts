import { describe, expect, it } from 'vitest'
import { createServer } from '../../src/protocol/server.js'
import { createHttpHandler } from '../../src/protocol/http.js'

describe('createHttpHandler', () => {
  it('returns a fetch-shaped handler', () => {
    const handler = createHttpHandler(() =>
      createServer({ name: 'browser-engine', version: '0.0.1' }),
    )
    expect(typeof handler.fetch).toBe('function')
  })

  it('answers a GET probe without throwing', async () => {
    const handler = createHttpHandler(() =>
      createServer({ name: 'browser-engine', version: '0.0.1' }),
    )
    const response = await handler.fetch(new Request('http://localhost/mcp', { method: 'GET' }))
    expect(response.status).toBeGreaterThanOrEqual(200)
    expect(response.status).toBeLessThan(600)
  })

  it('invokes the server factory on an initialize POST', async () => {
    let built = 0
    const handler = createHttpHandler(() => {
      built += 1
      return createServer({ name: 'browser-engine', version: '0.0.1' })
    })
    const response = await handler.fetch(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2026-07-28',
            capabilities: {},
            clientInfo: { name: 'test', version: '0.0.1' },
          },
        }),
      }),
    )
    expect(response.status).toBe(200)
    expect(built).toBeGreaterThan(0)
    const body = await response.text()
    expect(body).toContain('"name":"browser-engine"')
    expect(body).toContain('"version":"0.0.1"')
  })
})
