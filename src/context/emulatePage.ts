import type { PageLike } from './ContextPage.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

interface EmulateOptions {
  cpu?: number
  offline?: boolean
  downloadThroughput?: number
  uploadThroughput?: number
  latency?: number
}

function parseEmulateOptions(options: unknown): EmulateOptions | null {
  if (!isRecord(options)) {
    return null
  }
  const parsed: EmulateOptions = {}
  if (typeof options.cpu === 'number') {
    parsed.cpu = options.cpu
  }
  if (typeof options.offline === 'boolean') {
    parsed.offline = options.offline
  }
  if (typeof options.downloadThroughput === 'number') {
    parsed.downloadThroughput = options.downloadThroughput
  }
  if (typeof options.uploadThroughput === 'number') {
    parsed.uploadThroughput = options.uploadThroughput
  }
  if (typeof options.latency === 'number') {
    parsed.latency = options.latency
  }
  return parsed
}

/**
 * Applies optional CPU / network emulation via CDP.
 * Network.emulateNetworkConditions requires offline, throughput, and latency;
 * omitted fields use CDP defaults (-1 throughput, 0 latency, online).
 */
export async function emulatePage(page: PageLike, options: unknown): Promise<void> {
  const parsed = parseEmulateOptions(options)
  if (parsed === null) {
    return
  }
  if (parsed.cpu !== undefined) {
    await page.cdp('page', 'Emulation.setCPUThrottlingRate', { rate: parsed.cpu })
  }
  const hasNetwork =
    parsed.offline !== undefined ||
    parsed.downloadThroughput !== undefined ||
    parsed.uploadThroughput !== undefined ||
    parsed.latency !== undefined
  if (!hasNetwork) {
    return
  }
  await page.cdp('page', 'Network.emulateNetworkConditions', {
    offline: parsed.offline ?? false,
    downloadThroughput: parsed.downloadThroughput ?? -1,
    uploadThroughput: parsed.uploadThroughput ?? -1,
    latency: parsed.latency ?? 0,
  })
}
