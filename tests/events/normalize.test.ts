import { describe, expect, it } from 'vitest'
import {
  normalizeConsole,
  normalizeDom,
  normalizeNavigation,
  normalizeNetwork,
} from '../../src/events/normalize.js'

describe('normalizeConsole', () => {
  it('builds a console event with level and text', () => {
    expect(normalizeConsole('error', 'boom', 100)).toEqual({
      type: 'console',
      timestamp: 100,
      level: 'error',
      text: 'boom',
    })
  })

  it('accepts any console level', () => {
    expect(normalizeConsole('warn', 'careful', 1).level).toBe('warn')
    expect(normalizeConsole('debug', 'dbg', 1).level).toBe('debug')
  })
})

describe('normalizeNetwork', () => {
  it('builds a successful network event', () => {
    expect(normalizeNetwork('https://example.com', 200, false, 50)).toEqual({
      type: 'network',
      timestamp: 50,
      url: 'https://example.com',
      status: 200,
      failed: false,
    })
  })

  it('builds a failed network event', () => {
    expect(normalizeNetwork('https://example.com', 0, true, 50)).toEqual({
      type: 'network',
      timestamp: 50,
      url: 'https://example.com',
      status: 0,
      failed: true,
    })
  })
})

describe('normalizeDom', () => {
  it('builds a dom event with kind and target', () => {
    expect(normalizeDom('added', 'div#main', 10)).toEqual({
      type: 'dom',
      timestamp: 10,
      kind: 'added',
      target: 'div#main',
    })
  })

  it('accepts any dom kind', () => {
    expect(normalizeDom('removed', 'p', 1).kind).toBe('removed')
    expect(normalizeDom('changed', 'input', 1).kind).toBe('changed')
  })
})

describe('normalizeNavigation', () => {
  it('builds a navigation event with url', () => {
    expect(normalizeNavigation('https://example.com/page', 200)).toEqual({
      type: 'navigation',
      timestamp: 200,
      url: 'https://example.com/page',
    })
  })
})
