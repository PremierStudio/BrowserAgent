import { createServer } from 'node:http'

/** Pathname of an IncomingMessage url, defaulting a missing url to /. */
export function htmlRequestPathname(url: string | undefined): string {
  return new URL(url === undefined ? '/' : url, 'http://127.0.0.1').pathname
}

/** Loopback URL for a Node listen address, or fallbackPort when address is not TCP. */
export function loopbackUrlFromAddress(
  address: string | { port: number } | null,
  fallbackPort: number,
): string {
  if (typeof address === 'object' && address !== null) {
    return `http://127.0.0.1:${address.port}/`
  }
  return `http://127.0.0.1:${fallbackPort}/`
}

/**
 * Serves a fixed HTML document on 127.0.0.1. Port 0 binds an ephemeral port.
 * Integration tests use this so Chrome never depends on the public network.
 */
export function startLocalHtmlServer(
  html: string,
  port = 0,
): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (htmlRequestPathname(req.url) === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(html)
        return
      }
      res.writeHead(404)
      res.end()
    })

    const fail = (error: Error): void => {
      reject(error)
    }
    server.once('error', fail)
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', fail)
      resolve({
        url: loopbackUrlFromAddress(server.address(), port),
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error !== undefined) {
                closeReject(error)
                return
              }
              closeResolve()
            })
          }),
      })
    })
  })
}
