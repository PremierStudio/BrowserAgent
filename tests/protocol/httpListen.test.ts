import { describe, expect, it } from 'vitest'
import {
  applyIncomingHeaders,
  asBuffer,
  boundPort,
  finishClose,
  HTTP_LISTEN_HOST,
  isHttpArg,
  listenHttp,
  requestHost,
  requestMethod,
  requestUrlPath,
} from '../../src/protocol/httpListen.js'

describe('applyIncomingHeaders', () => {
  it('sets string headers and appends array values', () => {
    const headers = new Headers()
    applyIncomingHeaders(
      { accept: 'text/plain', 'set-cookie': ['a=1', 'b=2'], skip: undefined },
      headers,
    )
    expect(headers.get('accept')).toBe('text/plain')
    expect(headers.get('set-cookie')).toContain('a=1')
    expect(headers.get('set-cookie')).toContain('b=2')
    expect(headers.getSetCookie()).toEqual(['a=1', 'b=2'])
    expect(headers.has('skip')).toBe(false)
  })
})

describe('finishClose', () => {
  it('rejects when close reports an error', async () => {
    await expect(
      new Promise<void>((resolve, reject) => {
        finishClose(new Error('already closed'), resolve, reject)
      }),
    ).rejects.toThrow(/already closed/)
  })

  it('resolves when close reports no error', async () => {
    await expect(
      new Promise<void>((resolve, reject) => {
        finishClose(undefined, resolve, reject)
      }),
    ).resolves.toBeUndefined()
  })
})

describe('request helpers', () => {
  it('falls back when host, url, or method are missing', () => {
    expect(HTTP_LISTEN_HOST).toBe('127.0.0.1')
    expect(requestHost(undefined, 9)).toBe('127.0.0.1:9')
    expect(requestHost('example.test', 9)).toBe('example.test')
    expect(requestUrlPath(undefined)).toBe('/')
    expect(requestUrlPath('/x')).toBe('/x')
    expect(requestMethod(undefined)).toBe('GET')
    expect(requestMethod('POST')).toBe('POST')
  })

  it('normalizes body chunks and bound ports', () => {
    expect(asBuffer(Buffer.from('a')).equals(Buffer.from('a'))).toBe(true)
    expect(asBuffer('hi').equals(Buffer.from('hi'))).toBe(true)
    expect(boundPort({ port: 44 }, 1)).toBe(44)
    expect(boundPort(null, 7)).toBe(7)
    expect(boundPort('/tmp/sock', 7)).toBe(7)
  })
})

describe('isHttpArg', () => {
  it('is true when --http is present', () => {
    expect(isHttpArg(['node', 'cli.js', '--http'])).toBe(true)
  })

  it('is false when --http is absent', () => {
    expect(isHttpArg(['node', 'cli.js'])).toBe(false)
  })
})

describe('listenHttp', () => {
  it('serves the handler fetch on an ephemeral port', async () => {
    const server = await listenHttp(
      {
        fetch: async (request) => {
          const url = new URL(request.url)
          return new Response(JSON.stringify({ path: url.pathname }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        },
      },
      0,
    )
    const response = await fetch(new URL('/ping', `http://127.0.0.1:${server.port}`))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/application\/json/)
    expect(await response.json()).toEqual({ path: '/ping' })
    const closedUrl = `http://127.0.0.1:${server.port}/ping`
    await server.close()
    await expect(fetch(closedUrl)).rejects.toThrow()
  })

  it('forwards method, headers, and body', async () => {
    let seen = ''
    const server = await listenHttp({
      fetch: async (request) => {
        seen = `${request.method}:${await request.text()}`
        return new Response('ok', { status: 201 })
      },
    })
    const response = await fetch(`http://127.0.0.1:${server.port}/`, {
      method: 'POST',
      headers: { 'x-test': 'yes' },
      body: 'hello',
    })
    expect(response.status).toBe(201)
    expect(seen).toBe('POST:hello')
    const getResponse = await fetch(`http://127.0.0.1:${server.port}/`)
    expect(getResponse.status).toBe(201)
    const headResponse = await fetch(`http://127.0.0.1:${server.port}/`, { method: 'HEAD' })
    expect(headResponse.status).toBe(201)
    const closedUrl = `http://127.0.0.1:${server.port}/`
    await server.close()
    await expect(fetch(closedUrl)).rejects.toThrow()
  })

  it('answers 500 when the handler throws', async () => {
    const server = await listenHttp({
      fetch: async () => {
        throw new Error('boom')
      },
    })
    const response = await fetch(`http://127.0.0.1:${server.port}/`)
    expect(response.status).toBe(500)
    const closedUrl = `http://127.0.0.1:${server.port}/`
    await server.close()
    await expect(fetch(closedUrl)).rejects.toThrow()
  })
})
