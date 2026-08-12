import { describe, expect, it } from 'vitest'
import { buildSnapshot, type RawA11yNode } from '../../src/snapshot/a11ySnapshot.js'

function rawNode(overrides: Partial<RawA11yNode> = {}): RawA11yNode {
  return {
    role: 'generic',
    name: '',
    backendDOMNodeId: 1,
    loaderId: 'loader-1',
    ...overrides,
  }
}

describe('buildSnapshot', () => {
  it('builds a snapshot node with uid, role, name and children', () => {
    const root = rawNode({
      role: 'button',
      name: 'Submit',
      backendDOMNodeId: 42,
      loaderId: 'loader-1',
    })
    const snapshot = buildSnapshot(root)
    expect(snapshot.uid).toBe('loader-1_42')
    expect(snapshot.role).toBe('button')
    expect(snapshot.name).toBe('Submit')
    expect('children' in snapshot).toBe(false)
  })

  it('recursively builds children', () => {
    const root = rawNode({
      backendDOMNodeId: 1,
      children: [rawNode({ role: 'textbox', name: 'Field', backendDOMNodeId: 2 })],
    })
    const snapshot = buildSnapshot(root)
    expect(snapshot.children).toHaveLength(1)
    const child = snapshot.children?.[0]
    expect(child).toBeDefined()
    expect(child?.uid).toBe('loader-1_2')
    expect(child?.role).toBe('textbox')
    expect(child?.name).toBe('Field')
  })

  it('omits value when it is absent', () => {
    const snapshot = buildSnapshot(rawNode({ role: 'textbox', name: 'Field' }))
    expect('value' in snapshot).toBe(false)
  })

  it('includes value when present', () => {
    const snapshot = buildSnapshot(rawNode({ role: 'textbox', name: 'Field', value: 'hello' }))
    expect(snapshot.value).toBe('hello')
  })

  it('omits boundingBox when absent', () => {
    const snapshot = buildSnapshot(rawNode({ role: 'button', name: 'B' }))
    expect('boundingBox' in snapshot).toBe(false)
  })

  it('includes boundingBox when present', () => {
    const snapshot = buildSnapshot(
      rawNode({ role: 'button', name: 'B', boundingBox: { x: 1, y: 2, width: 3, height: 4 } }),
    )
    expect(snapshot.boundingBox).toEqual({ x: 1, y: 2, width: 3, height: 4 })
  })

  it('omits zIndex when absent', () => {
    const snapshot = buildSnapshot(rawNode({ role: 'button', name: 'B' }))
    expect('zIndex' in snapshot).toBe(false)
  })

  it('includes zIndex when present', () => {
    const snapshot = buildSnapshot(rawNode({ role: 'button', name: 'B', zIndex: 5 }))
    expect(snapshot.zIndex).toBe(5)
  })

  it('omits empty children array from the output', () => {
    const snapshot = buildSnapshot(rawNode({ role: 'button', name: 'B' }))
    expect('children' in snapshot).toBe(false)
  })

  it('omits an explicitly empty children array from the output', () => {
    const snapshot = buildSnapshot(rawNode({ role: 'button', name: 'B', children: [] }))
    expect('children' in snapshot).toBe(false)
  })

  it('includes children array when there are children', () => {
    const snapshot = buildSnapshot(
      rawNode({ role: 'group', name: '', children: [rawNode({ role: 'text', name: 'x' })] }),
    )
    expect(snapshot.children).toHaveLength(1)
  })

  it('handles a missing backendDOMNodeId by using a placeholder uid', () => {
    const snapshot = buildSnapshot(rawNode({ role: 'generic', name: '', backendDOMNodeId: 0 }))
    expect(snapshot.uid).toContain('0')
  })
})
