import { foldLabel, isTitleLike } from '../label.js'
import type { SnapshotNode } from './a11ySnapshot.js'

/** Roles that matter when planning a run_flow. Everything else is noise. */
export const OUTLINE_ROLES: ReadonlySet<string> = new Set([
  'heading',
  'link',
  'button',
  'textbox',
  'searchbox',
  'combobox',
  'spinbutton',
  'checkbox',
  'radio',
  'tab',
  'menuitem',
  'slider',
  'switch',
  'alert',
])

const TYPEABLE = new Set(['textbox', 'searchbox', 'combobox', 'spinbutton'])
const CLICKABLE = new Set(['button', 'link', 'checkbox', 'radio', 'tab', 'menuitem', 'switch'])
const PAGE_ROLES = new Set(['RootWebArea', 'document', 'WebArea', 'Iframe'])

/** A flattened interactive or section node. */
export interface OutlineItem {
  uid: string
  role: string
  name: string
  value?: string
  context?: string
}

type WalkState = {
  lastTitle?: string
  lastTypeable?: string
  lastEmitted?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]'
}

/** Narrow an observe snapshot to a SnapshotNode, or reject it. */
export function asSnapshotNode(value: unknown): SnapshotNode | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  if (
    typeof value.uid !== 'string' ||
    typeof value.role !== 'string' ||
    typeof value.name !== 'string'
  ) {
    return undefined
  }
  const node: SnapshotNode = { uid: value.uid, role: value.role, name: value.name }
  if (typeof value.value === 'string') {
    node.value = value.value
  }
  if (Array.isArray(value.children)) {
    const children: SnapshotNode[] = []
    for (const child of value.children) {
      const parsed = asSnapshotNode(child)
      if (parsed !== undefined) {
        children.push(parsed)
      }
    }
    if (children.length > 0) {
      node.children = children
    }
  }
  return node
}

/** Flatten an unknown observe snapshot, or return an empty list. */
export function outlineFromUnknown(value: unknown): OutlineItem[] {
  const snapshot = asSnapshotNode(value)
  if (snapshot === undefined) {
    return []
  }
  return outlineFromSnapshot(snapshot)
}

/** Flatten a snapshot into headings, controls, and alerts with uids. */
export function outlineFromSnapshot(node: SnapshotNode): OutlineItem[] {
  const items: OutlineItem[] = []
  collect(node, items, {})
  return items
}

/** Any named non-control can be a `near` landmark. Roles are not a catalog. */
function isTextLandmark(node: SnapshotNode): boolean {
  if (PAGE_ROLES.has(node.role) || CLICKABLE.has(node.role) || TYPEABLE.has(node.role)) {
    return false
  }
  return isTitleLike(node.name)
}

function firstTextIn(node: SnapshotNode): string | undefined {
  if (isTextLandmark(node)) {
    return node.name
  }
  if (node.children === undefined) {
    return undefined
  }
  for (const child of node.children) {
    const found = firstTextIn(child)
    if (found !== undefined) {
      return found
    }
  }
  return undefined
}

function firstDirectTextLandmark(children: readonly SnapshotNode[]): string | undefined {
  for (const child of children) {
    const found = firstTextIn(child)
    if (found !== undefined) {
      return found
    }
  }
  return undefined
}

function displayNameOf(node: SnapshotNode, state: WalkState): string {
  if (CLICKABLE.has(node.role) && foldLabel(node.name) === '' && state.lastTypeable !== undefined) {
    return state.lastTypeable
  }
  if (TYPEABLE.has(node.role) && foldLabel(node.name) === '' && state.lastTitle !== undefined) {
    return state.lastTitle
  }
  return node.name
}

function pushItem(
  items: OutlineItem[],
  node: SnapshotNode,
  name: string,
  context: string | undefined,
): void {
  const item: OutlineItem = { uid: node.uid, role: node.role, name }
  if (node.value !== undefined) {
    item.value = node.value
  }
  if (context !== undefined && foldLabel(context) !== foldLabel(name)) {
    item.context = context
  }
  items.push(item)
}

function collect(node: SnapshotNode, items: OutlineItem[], state: WalkState): void {
  const name = displayNameOf(node, state)
  const inOutline = OUTLINE_ROLES.has(node.role)
  const inLandmark = isTextLandmark(node)
  const sameAsLast =
    state.lastEmitted !== undefined && foldLabel(name) === foldLabel(state.lastEmitted)
  if (inOutline || (inLandmark && !sameAsLast)) {
    const context = inLandmark ? undefined : state.lastTitle
    pushItem(items, node, name, context)
    state.lastEmitted = name
  }
  if (node.children === undefined) {
    return
  }
  const group: WalkState = {
    lastTitle: firstDirectTextLandmark(node.children) ?? state.lastTitle,
    lastTypeable: state.lastTypeable,
    lastEmitted: state.lastEmitted,
  }
  for (const child of node.children) {
    collect(child, items, group)
    if (isTextLandmark(child)) {
      group.lastTitle = child.name
    }
    if (TYPEABLE.has(child.role)) {
      group.lastTypeable = child.name
    }
  }
  state.lastEmitted = group.lastEmitted
}
