import { describe, expect, it } from 'vitest'
import { verify } from '../../src/intent/verify.js'
import type { SnapshotNode } from '../../src/snapshot/a11ySnapshot.js'

const tree: SnapshotNode = {
  uid: 'root',
  role: 'document',
  name: 'Home',
  children: [{ uid: 'btn-1', role: 'button', name: 'Submit', value: 'go' }],
}

describe('verify', () => {
  it('passes uidExists when the uid is present', () => {
    const result = verify(tree, { kind: 'uidExists', uid: 'btn-1' })
    expect(result.pass).toBe(true)
    expect(result.evidence).toMatch(/btn-1/)
  })

  it('fails uidExists when the uid is missing', () => {
    const result = verify(tree, { kind: 'uidExists', uid: 'nope' })
    expect(result.pass).toBe(false)
    expect(result.evidence).toMatch(/not found/)
  })

  it('passes role when the expected role matches', () => {
    expect(verify(tree, { kind: 'role', uid: 'btn-1', expected: 'button' }).pass).toBe(true)
  })

  it('fails role when the expected role differs', () => {
    const result = verify(tree, { kind: 'role', uid: 'btn-1', expected: 'link' })
    expect(result.pass).toBe(false)
    expect(result.evidence).toMatch(/button/)
  })

  it('passes name when the expected name matches', () => {
    expect(verify(tree, { kind: 'name', uid: 'btn-1', expected: 'Submit' }).pass).toBe(true)
  })

  it('fails name when the expected name differs', () => {
    expect(verify(tree, { kind: 'name', uid: 'btn-1', expected: 'Cancel' }).pass).toBe(false)
  })

  it('passes value when the expected value matches', () => {
    expect(verify(tree, { kind: 'value', uid: 'btn-1', expected: 'go' }).pass).toBe(true)
  })

  it('fails value when the expected value differs or is missing', () => {
    expect(verify(tree, { kind: 'value', uid: 'btn-1', expected: 'stop' }).pass).toBe(false)
    expect(verify(tree, { kind: 'value', uid: 'root', expected: 'go' }).pass).toBe(false)
  })

  it('passes textContains when the text appears', () => {
    expect(verify(tree, { kind: 'textContains', expected: 'Sub' }).pass).toBe(true)
  })

  it('fails textContains when the text is absent', () => {
    expect(verify(tree, { kind: 'textContains', expected: 'nope' }).pass).toBe(false)
  })

  it('fails field assertions when the uid is missing', () => {
    expect(verify(tree, { kind: 'role', uid: 'nope', expected: 'button' }).pass).toBe(false)
    expect(verify(tree, { kind: 'name', uid: 'nope', expected: 'Submit' }).pass).toBe(false)
    expect(verify(tree, { kind: 'value', uid: 'nope', expected: 'go' }).pass).toBe(false)
  })
})
