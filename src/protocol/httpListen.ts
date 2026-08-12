import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

/** True when argv requests the Streamable HTTP transport. */
export function isHttpArg(argv: string[]): boolean {
  return argv.includes('--http')
}

/** A fetch-shaped MCP HTTP handler. */
export interface FetchHandler {
  fetch: (request: Request) => Promise<Response>
}

/** A listening HTTP server wrapping a fetch handler. */
export interface HttpListenHandle {
  port: number
  close: () => Promise<void>
}

/** Copies Node incoming headers onto a Fetch Headers object. */
export function applyIncomingHeaders(
  incoming: Record<string, string | string[] | undefined>,
  headers: Headers,
): void {
  for (const [key, value] of Object.entries(incoming)) {
    if (typeof value === 'string') {
      headers.set(key, value)
    } else if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item)
      }
    }
  }
}

/** Resolves or rejects a server.close() callback. */
/** Host header, or a loopback fallback when the client omitted it. */
export function requestHost(host: string | undefined, port: number): string {
  return host ?? `127.0.0.1:${port}`
}

/** Request path, or `/` when Node omitted the url. */
export function requestUrlPath(url: string | undefined): string {
  return url ?? '/'
}

/** HTTP method, or GET when Node omitted it. */
export function requestMethod(method: string | undefined): string {
  return method ?? 'GET'
}

/** Normalizes a request body chunk to a Buffer. */
export function asBuffer(chunk: unknown): Buffer {
  return Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
}

/** Bound TCP port from server.address(), or the listen fallback. */
export function boundPort(address: string | { port: number } | null, fallback: number): number {
  return typeof address === 'object' && address !== null ? address.port : fallback
}

export function finishClose(
  error: Error | undefined,
  resolve: () => void,
  reject: (error: Error) => void,
): void {
  if (error !== undefined) {
    reject(error)
    return
  }
  resolve()
}

async function toRequest(req: IncomingMessage, port: number): Promise<Request> {
  const host = requestHost(req.headers.host, port)
  const url = new URL(requestUrlPath(req.url), `http://${host}`)
  const headers = new Headers()
  applyIncomingHeaders(req.headers, headers)
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(asBuffer(chunk))
  }
  const method = requestMethod(req.method)
  const init: RequestInit = { method, headers }
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = Buffer.concat(chunks)
  }
  return new Request(url, init)
}

async function writeResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  for (const [key, value] of response.headers) {
    res.setHeader(key, value)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  res.end(bytes)
}

/**
 * Serves a fetch-shaped handler over Node HTTP. Port 0 binds an ephemeral port.
 */
export async function listenHttp(handler: FetchHandler, port = 0): Promise<HttpListenHandle> {
  const server = createServer((req, res) => {
    void toRequest(req, port)
      .then((request) => handler.fetch(request))
      .then((response) => writeResponse(res, response))
      .catch(() => {
        res.statusCode = 500
        res.end()
      })
  })
  await new Promise<void>((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  const bound = boundPort(address, port)
  return {
    port: bound,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          finishClose(error, resolve, reject)
        })
      }),
  }
}
