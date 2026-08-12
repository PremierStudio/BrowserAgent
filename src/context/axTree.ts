import type { BoundingBox, RawA11yNode } from '../snapshot/a11ySnapshot.js'

/** A single node in the CDP accessibility tree. */
export interface AxNode {
  nodeId: string
  ignored: boolean
  role?: { value: string }
  name?: { value: string }
  value?: { value: string }
  backendDOMNodeId?: number
  childIds?: string[]
}

/** A lookup from backendDOMNodeId to its pixel bounding box. */
export type BoxLookup = Map<number, BoundingBox>

/** A lookup from backendDOMNodeId to its z-index. */
export type ZIndexLookup = Map<number, number>

/**
 * Converts a flat CDP accessibility tree into a nested raw snapshot tree.
 * Nodes are connected by childIds; ignored nodes are filtered out; bounding
 * boxes and z-indexes are attached from the provided lookups. This is pure
 * logic so it can be unit-tested without a browser.
 */
export function buildRawTree(
  nodes: AxNode[],
  boxes: BoxLookup,
  loaderId: string,
  zIndexes: ZIndexLookup = new Map(),
): RawA11yNode {
  const byId = new Map<string, AxNode>()
  for (const node of nodes) {
    byId.set(node.nodeId, node)
  }

  const build = (node: AxNode): RawA11yNode => {
    const raw: RawA11yNode = {
      role: node.role?.value ?? 'generic',
      name: node.name?.value ?? '',
      backendDOMNodeId: node.backendDOMNodeId ?? 0,
      loaderId,
    }
    if (node.value !== undefined) {
      raw.value = node.value.value
    }
    const box = node.backendDOMNodeId !== undefined ? boxes.get(node.backendDOMNodeId) : undefined
    if (box !== undefined) {
      raw.boundingBox = box
    }
    const zIndex =
      node.backendDOMNodeId !== undefined ? zIndexes.get(node.backendDOMNodeId) : undefined
    if (zIndex !== undefined) {
      raw.zIndex = zIndex
    }
    if (node.childIds !== undefined) {
      const children: RawA11yNode[] = []
      for (const childId of node.childIds) {
        const child = byId.get(childId)
        if (child !== undefined && !child.ignored) {
          children.push(build(child))
        }
      }
      if (children.length > 0) {
        raw.children = children
      }
    }
    return raw
  }

  return build(nodes[0] ?? { nodeId: 'root', ignored: false })
}
