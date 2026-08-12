import type { ConsoleEvent, DomEvent, NavigationEvent, NetworkEvent } from './types.js'

/** Builds a normalized console event. */
export function normalizeConsole(
  level: ConsoleEvent['level'],
  text: string,
  timestamp: number,
): ConsoleEvent {
  return { type: 'console', timestamp, level, text }
}

/** Builds a normalized network event. */
export function normalizeNetwork(
  url: string,
  status: number,
  failed: boolean,
  timestamp: number,
): NetworkEvent {
  return { type: 'network', timestamp, url, status, failed }
}

/** Builds a normalized DOM event. */
export function normalizeDom(kind: DomEvent['kind'], target: string, timestamp: number): DomEvent {
  return { type: 'dom', timestamp, kind, target }
}

/** Builds a normalized navigation event. */
export function normalizeNavigation(url: string, timestamp: number): NavigationEvent {
  return { type: 'navigation', timestamp, url }
}
