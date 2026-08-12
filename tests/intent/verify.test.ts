import { describe, expect, it } from 'vitest'
import { verify } from '../../src/intent/verify.js'
import type { SnapshotNode } from '../../src/snapshot/a11ySnapshot.js'

const tree: SnapshotNode = {
  uid: 'root',
  role: 'document',
  name: 'Home',
  children: [
    { uid: 'link-1', role: 'link', name: 'Skip' },
    { uid: 'btn-1', role: 'button', name: 'Submit', value: 'go' },
  ],
}

describe('verify', () => {
  it('passes uidExists when the uid is present', () => {
    expect(verify(tree, { kind: 'uidExists', uid: 'btn-1' })).toEqual({
      pass: true,
      evidence: 'uid btn-1 is present',
    })
  })

  it('finds a uid on a later sibling after an earlier branch misses', () => {
    expect(verify(tree, { kind: 'uidExists', uid: 'btn-1' }).pass).toBe(true)
    expect(verify(tree, { kind: 'role', uid: 'btn-1', expected: 'button' })).toEqual({
      pass: true,
      evidence: 'uid btn-1 has role button',
    })
  })

  it('fails uidExists when the uid is missing', () => {
    expect(verify(tree, { kind: 'uidExists', uid: 'nope' })).toEqual({
      pass: false,
      evidence: 'uid nope not found',
    })
  })

  it('passes role when the expected role matches', () => {
    expect(verify(tree, { kind: 'role', uid: 'btn-1', expected: 'button' })).toEqual({
      pass: true,
      evidence: 'uid btn-1 has role button',
    })
  })

  it('fails role when the expected role differs', () => {
    expect(verify(tree, { kind: 'role', uid: 'btn-1', expected: 'link' })).toEqual({
      pass: false,
      evidence: 'uid btn-1 has role button, expected link',
    })
  })

  it('passes name when the expected name matches', () => {
    expect(verify(tree, { kind: 'name', uid: 'btn-1', expected: 'Submit' })).toEqual({
      pass: true,
      evidence: 'uid btn-1 has name "Submit"',
    })
  })

  it('fails name when the expected name differs', () => {
    expect(verify(tree, { kind: 'name', uid: 'btn-1', expected: 'Cancel' })).toEqual({
      pass: false,
      evidence: 'uid btn-1 has name "Submit", expected "Cancel"',
    })
  })

  it('passes value when the expected value matches', () => {
    expect(verify(tree, { kind: 'value', uid: 'btn-1', expected: 'go' })).toEqual({
      pass: true,
      evidence: 'uid btn-1 has value "go"',
    })
  })

  it('fails value when the expected value differs or is missing', () => {
    expect(verify(tree, { kind: 'value', uid: 'btn-1', expected: 'stop' })).toEqual({
      pass: false,
      evidence: 'uid btn-1 has value "go", expected "stop"',
    })
    expect(verify(tree, { kind: 'value', uid: 'root', expected: 'go' })).toEqual({
      pass: false,
      evidence: 'uid root has value "", expected "go"',
    })
  })

  it('treats a missing value as an empty string, not a placeholder', () => {
    expect(verify(tree, { kind: 'value', uid: 'root', expected: '' })).toEqual({
      pass: true,
      evidence: 'uid root has value ""',
    })
    expect(verify(tree, { kind: 'value', uid: 'root', expected: 'Stryker was here!' })).toEqual({
      pass: false,
      evidence: 'uid root has value "", expected "Stryker was here!"',
    })
  })

  it('passes textContains when the root name matches', () => {
    expect(verify(tree, { kind: 'textContains', expected: 'Home' })).toEqual({
      pass: true,
      evidence: 'text contains "Home"',
    })
  })

  it('passes textContains when only a node value matches', () => {
    expect(verify(tree, { kind: 'textContains', expected: 'go' })).toEqual({
      pass: true,
      evidence: 'text contains "go"',
    })
  })

  it('passes textContains when a descendant name matches', () => {
    expect(verify(tree, { kind: 'textContains', expected: 'Sub' })).toEqual({
      pass: true,
      evidence: 'text contains "Sub"',
    })
  })

  it('fails textContains when the text is absent', () => {
    expect(verify(tree, { kind: 'textContains', expected: 'nope' })).toEqual({
      pass: false,
      evidence: 'text does not contain "nope"',
    })
  })

  it('fails field assertions when the uid is missing', () => {
    expect(verify(tree, { kind: 'role', uid: 'nope', expected: 'button' })).toEqual({
      pass: false,
      evidence: 'uid nope not found',
    })
    expect(verify(tree, { kind: 'name', uid: 'nope', expected: 'Submit' })).toEqual({
      pass: false,
      evidence: 'uid nope not found',
    })
    expect(verify(tree, { kind: 'value', uid: 'nope', expected: 'go' })).toEqual({
      pass: false,
      evidence: 'uid nope not found',
    })
  })
})
