import { describe, expect, it } from 'vitest'
import { createUid, parseUid, type UidParts } from '../src/uid.js'

describe('createUid', () => {
  it('produces a deterministic uid for the same inputs', () => {
    const a = createUid('loader-1', 42)
    const b = createUid('loader-1', 42)
    expect(a).toBe(b)
  })

  it('produces different uids for different backendNodeIds', () => {
    const a = createUid('loader-1', 42)
    const b = createUid('loader-1', 43)
    expect(a).not.toBe(b)
  })

  it('produces different uids for different loaderIds', () => {
    const a = createUid('loader-1', 42)
    const b = createUid('loader-2', 42)
    expect(a).not.toBe(b)
  })

  it('embeds the loaderId and backendNodeId in the uid', () => {
    const uid = createUid('loader-1', 42)
    expect(uid).toContain('loader-1')
    expect(uid).toContain('42')
  })

  it('handles a missing loaderId by using a placeholder', () => {
    const uid = createUid('', 42)
    expect(uid).toContain('42')
    expect(uid).toContain('no-loader')
    expect(uid).toBe('no-loader_42')
  })

  it('handles a missing backendNodeId', () => {
    const uid = createUid('loader-1', 0)
    expect(uid).toContain('loader-1')
  })

  it('produces a parseable uid', () => {
    const uid = createUid('loader-1', 42)
    const parts = parseUid(uid)
    expect(parts).not.toBeNull()
    if (parts !== null) {
      expect(parts.loaderId).toBe('loader-1')
      expect(parts.backendNodeId).toBe(42)
    }
  })
})

describe('parseUid', () => {
  it('parses a valid uid into its parts', () => {
    const parts = parseUid('loader-1_42')
    expect(parts).toEqual({ loaderId: 'loader-1', backendNodeId: 42 } satisfies UidParts)
  })

  it('returns null for a uid without a separator', () => {
    expect(parseUid('no-separator')).toBeNull()
  })

  it('returns null for a uid with a non-numeric backendNodeId', () => {
    expect(parseUid('loader-1_abc')).toBeNull()
  })

  it('returns null for a uid whose separator is the final character', () => {
    expect(parseUid('loader-1_')).toBeNull()
  })

  it('returns null for a uid whose separator is the first character', () => {
    expect(parseUid('_42')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(parseUid('')).toBeNull()
  })

  it('round-trips createUid through parseUid', () => {
    const uid = createUid('loader-xyz', 123)
    const parts = parseUid(uid)
    expect(parts).not.toBeNull()
    if (parts !== null) {
      expect(createUid(parts.loaderId, parts.backendNodeId)).toBe(uid)
    }
  })
})
