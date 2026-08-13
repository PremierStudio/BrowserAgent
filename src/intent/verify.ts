import type { SnapshotNode } from '../snapshot/a11ySnapshot.js'
import { foldLabel } from '../label.js'

/** An assertion that verify() evaluates against a snapshot. */
export type Assertion =
  | { kind: 'uidExists'; uid: string }
  | { kind: 'role'; uid: string; expected: string }
  | { kind: 'name'; uid: string; expected: string }
  | { kind: 'value'; uid: string; expected: string }
  | { kind: 'textContains'; expected: string }

/** The result of evaluating an assertion. */
export interface VerifyResult {
  pass: boolean
  evidence: string
}

function findNode(node: SnapshotNode, uid: string): SnapshotNode | undefined {
  if (node.uid === uid) {
    return node
  }
  if (node.children === undefined) {
    return undefined
  }
  for (const child of node.children) {
    const found = findNode(child, uid)
    if (found !== undefined) {
      return found
    }
  }
  return undefined
}

function containsText(node: SnapshotNode, expected: string): boolean {
  const want = foldLabel(expected)
  if (want === '') {
    return false
  }
  if (foldLabel(node.name).includes(want)) {
    return true
  }
  if (node.value !== undefined && foldLabel(node.value).includes(want)) {
    return true
  }
  if (node.children === undefined) {
    return false
  }
  for (const child of node.children) {
    if (containsText(child, expected)) {
      return true
    }
  }
  return false
}

function missing(uid: string): VerifyResult {
  return { pass: false, evidence: `uid ${uid} not found` }
}

/** Evaluates an assertion against a snapshot and returns pass/fail with evidence. */
export function verify(snapshot: SnapshotNode, assertion: Assertion): VerifyResult {
  if (assertion.kind === 'textContains') {
    if (containsText(snapshot, assertion.expected)) {
      return { pass: true, evidence: `text contains "${assertion.expected}"` }
    }
    return { pass: false, evidence: `text does not contain "${assertion.expected}"` }
  }
  if (assertion.kind === 'uidExists') {
    if (findNode(snapshot, assertion.uid) !== undefined) {
      return { pass: true, evidence: `uid ${assertion.uid} is present` }
    }
    return missing(assertion.uid)
  }
  const node = findNode(snapshot, assertion.uid)
  if (node === undefined) {
    return missing(assertion.uid)
  }
  if (assertion.kind === 'role') {
    if (node.role === assertion.expected) {
      return { pass: true, evidence: `uid ${assertion.uid} has role ${node.role}` }
    }
    return {
      pass: false,
      evidence: `uid ${assertion.uid} has role ${node.role}, expected ${assertion.expected}`,
    }
  }
  if (assertion.kind === 'name') {
    if (node.name === assertion.expected) {
      return { pass: true, evidence: `uid ${assertion.uid} has name "${node.name}"` }
    }
    return {
      pass: false,
      evidence: `uid ${assertion.uid} has name "${node.name}", expected "${assertion.expected}"`,
    }
  }
  const actual = node.value ?? ''
  if (actual === assertion.expected) {
    return { pass: true, evidence: `uid ${assertion.uid} has value "${actual}"` }
  }
  return {
    pass: false,
    evidence: `uid ${assertion.uid} has value "${actual}", expected "${assertion.expected}"`,
  }
}
