/** A console event captured from the page. */
export interface ConsoleEvent {
  type: 'console'
  timestamp: number
  level: 'log' | 'info' | 'warn' | 'error' | 'debug'
  text: string
}

/** A network event captured from the page. */
export interface NetworkEvent {
  type: 'network'
  timestamp: number
  url: string
  status: number
  failed: boolean
}

/** A DOM mutation event captured from the page. */
export interface DomEvent {
  type: 'dom'
  timestamp: number
  kind: 'added' | 'removed' | 'changed'
  target: string
}

/** A navigation event captured from the page. */
export interface NavigationEvent {
  type: 'navigation'
  timestamp: number
  url: string
}

/** A single browser event, discriminated by type. */
export type BrowserEvent = ConsoleEvent | NetworkEvent | DomEvent | NavigationEvent
