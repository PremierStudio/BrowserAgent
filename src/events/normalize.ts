import type { WindowLayout } from '../browser/windowLayout.js'
import type { ConsoleEvent, DomEvent, NavigationEvent, NetworkEvent, ResizeEvent } from './types.js'

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

/** Builds a normalized resize event from the live window layout. */
export function normalizeResize(layout: WindowLayout, timestamp: number): ResizeEvent {
  return {
    type: 'resize',
    timestamp,
    width: layout.width,
    height: layout.height,
    viewportWidth: layout.viewportWidth,
    viewportHeight: layout.viewportHeight,
  }
}
