import { describe, expect, it } from 'vitest'
import {
  htmlRequestPathname,
  loopbackUrlFromAddress,
  startLocalHtmlServer,
} from '../../src/testing/localHtmlServer.js'

function portFromUrl(url: string): number {
  const parsed = new URL(url)
  const port = Number(parsed.port)
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`expected a positive port in ${url}`)
  }
  return port
}

function errorListenerCountOnPort(port: number): number {
  const getHandles = Reflect.get(process, '_getActiveHandles')
  if (typeof getHandles !== 'function') {
    throw new Error('expected process._getActiveHandles')
  }
  const handles = Reflect.apply(getHandles, process, [])
  if (!Array.isArray(handles)) {
    throw new Error('expected handle array')
  }
  for (const handle of handles) {
    if (typeof handle !== 'object' || handle === null) {
      continue
    }
    if (Reflect.get(handle, 'listening') !== true) {
      continue
    }
    const listenerCount = Reflect.get(handle, 'listenerCount')
    const address = Reflect.get(handle, 'address')
    if (typeof listenerCount !== 'function' || typeof address !== 'function') {
      continue
    }
    const addr = Reflect.apply(address, handle, [])
    if (typeof addr !== 'object' || addr === null) {
      continue
    }
    if (Reflect.get(addr, 'port') !== port) {
      continue
    }
    const count = Reflect.apply(listenerCount, handle, ['error'])
    if (typeof count !== 'number') {
      throw new Error('expected numeric listenerCount')
    }
    return count
  }
  throw new Error(`no listening server on port ${port}`)
}

describe('htmlRequestPathname', () => {
  it('treats a missing url as /', () => {
    expect(htmlRequestPathname(undefined)).toBe('/')
  })

  it('returns the pathname and ignores the query string', () => {
    expect(htmlRequestPathname('/')).toBe('/')
    expect(htmlRequestPathname('/?x=1')).toBe('/')
    expect(htmlRequestPathname('/other')).toBe('/other')
  })
})

describe('loopbackUrlFromAddress', () => {
  it('uses the TCP port when address is an object', () => {
    expect(loopbackUrlFromAddress({ port: 3456 }, 0)).toBe('http://127.0.0.1:3456/')
  })

  it('falls back when address is null or a pipe path', () => {
    expect(loopbackUrlFromAddress(null, 9)).toBe('http://127.0.0.1:9/')
    expect(loopbackUrlFromAddress('\\\\.\\pipe\\html', 11)).toBe('http://127.0.0.1:11/')
  })
})

describe('startLocalHtmlServer', () => {
  it('serves the given HTML at / with content-type text/html', async () => {
    const html = '<html><body><p>hello-local</p></body></html>'
    const server = await startLocalHtmlServer(html)
    try {
      expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/)
      const response = await fetch(server.url)
      expect(response.status).toBe(200)
      const contentType = response.headers.get('content-type')
      expect(contentType).toMatch(/text\/html/)
      expect(await response.text()).toBe(html)
    } finally {
      await server.close()
    }
  })

  it('serves the same HTML when / has a query string', async () => {
    const html = '<p>queried</p>'
    const server = await startLocalHtmlServer(html)
    try {
      const response = await fetch(`${server.url}?x=1`)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe(html)
    } finally {
      await server.close()
    }
  })

  it('answers 404 for paths other than /', async () => {
    const server = await startLocalHtmlServer('<p>root-only</p>')
    try {
      const response = await fetch(new URL('/other', server.url))
      expect(response.status).toBe(404)
    } finally {
      await server.close()
    }
  })

  it('binds two ephemeral servers on different ports when port is omitted', async () => {
    const first = await startLocalHtmlServer('<p>one</p>')
    const second = await startLocalHtmlServer('<p>two</p>')
    try {
      expect(first.url).not.toBe(second.url)
      expect(portFromUrl(first.url)).not.toBe(portFromUrl(second.url))
      expect(await (await fetch(first.url)).text()).toBe('<p>one</p>')
      expect(await (await fetch(second.url)).text()).toBe('<p>two</p>')
    } finally {
      await first.close()
      await second.close()
    }
  })

  it('listens on an explicit port and puts that port in the url', async () => {
    const probe = await startLocalHtmlServer('<p>probe</p>')
    const port = portFromUrl(probe.url)
    await probe.close()
    const server = await startLocalHtmlServer('<p>bound</p>', port)
    try {
      expect(server.url).toBe(`http://127.0.0.1:${port}/`)
      expect(await (await fetch(server.url)).text()).toBe('<p>bound</p>')
    } finally {
      await server.close()
    }
  })

  it('binds IPv4 loopback only so IPv6 loopback cannot connect', async () => {
    const server = await startLocalHtmlServer('<p>v4-only</p>')
    try {
      const port = portFromUrl(server.url)
      await expect(fetch(`http://[::1]:${port}/`)).rejects.toThrow()
      expect(await (await fetch(server.url)).text()).toBe('<p>v4-only</p>')
    } finally {
      await server.close()
    }
  })

  it('drops the listen-time error handler after the server is bound', async () => {
    const server = await startLocalHtmlServer('<p>no-error-hook</p>')
    try {
      expect(errorListenerCountOnPort(portFromUrl(server.url))).toBe(0)
    } finally {
      await server.close()
    }
  })

  it('rejects when the requested port is already bound', async () => {
    const first = await startLocalHtmlServer('<p>held</p>')
    try {
      await expect(startLocalHtmlServer('<p>clash</p>', portFromUrl(first.url))).rejects.toThrow()
    } finally {
      await first.close()
    }
  })

  it('close() stops serving so later fetches fail', async () => {
    const server = await startLocalHtmlServer('<p>closing</p>')
    const url = server.url
    await server.close()
    await expect(fetch(url)).rejects.toThrow()
  })

  it('close() rejects when the server is already closed', async () => {
    const server = await startLocalHtmlServer('<p>twice</p>')
    await server.close()
    await expect(server.close()).rejects.toThrow()
  })
})
