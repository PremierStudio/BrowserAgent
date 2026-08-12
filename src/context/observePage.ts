import type { PageLike, ObserveResult } from './ContextPage.js'
import { buildRawTree, type AxNode, type BoxLookup } from './axTree.js'
import { buildSnapshot, type BoundingBox } from '../snapshot/a11ySnapshot.js'
import { buildOverlay } from '../snapshot/overlay.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValueBag(value: unknown): value is { value: string } {
  return isRecord(value) && typeof value.value === 'string'
}

function parseAxNode(value: unknown): AxNode | undefined {
  if (!isRecord(value) || typeof value.nodeId !== 'string') {
    return undefined
  }
  const node: AxNode = {
    nodeId: value.nodeId,
    ignored: value.ignored === true,
  }
  if (isValueBag(value.role)) {
    node.role = value.role
  }
  if (isValueBag(value.name)) {
    node.name = value.name
  }
  if (isValueBag(value.value)) {
    node.value = value.value
  }
  if (typeof value.backendDOMNodeId === 'number') {
    node.backendDOMNodeId = value.backendDOMNodeId
  }
  if (Array.isArray(value.childIds)) {
    const childIds: string[] = []
    for (const id of value.childIds) {
      if (typeof id === 'string') {
        childIds.push(id)
      }
    }
    if (childIds.length > 0) {
      node.childIds = childIds
    }
  }
  return node
}

function axNodesFrom(result: unknown): AxNode[] {
  if (!isRecord(result) || !Array.isArray(result.nodes)) {
    return []
  }
  const nodes: AxNode[] = []
  for (const item of result.nodes) {
    const parsed = parseAxNode(item)
    if (parsed !== undefined) {
      nodes.push(parsed)
    }
  }
  return nodes
}

function loaderIdFrom(result: unknown): string {
  if (!isRecord(result) || !isRecord(result.frameTree) || !isRecord(result.frameTree.frame)) {
    return ''
  }
  const loaderId = result.frameTree.frame.loaderId
  return typeof loaderId === 'string' ? loaderId : ''
}

function boxFromModel(result: unknown): BoundingBox | undefined {
  if (!isRecord(result) || !isRecord(result.model) || !Array.isArray(result.model.content)) {
    return undefined
  }
  const content = result.model.content
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i + 1 < content.length; i += 2) {
    const x = content[i]
    const y = content[i + 1]
    if (typeof x === 'number' && typeof y === 'number') {
      xs.push(x)
      ys.push(y)
    }
  }
  let minX: number | undefined
  let maxX: number | undefined
  for (const x of xs) {
    if (minX === undefined || x < minX) {
      minX = x
    }
    if (maxX === undefined || x > maxX) {
      maxX = x
    }
  }
  let minY: number | undefined
  let maxY: number | undefined
  for (const y of ys) {
    if (minY === undefined || y < minY) {
      minY = y
    }
    if (maxY === undefined || y > maxY) {
      maxY = y
    }
  }
  if (minX === undefined || maxX === undefined || minY === undefined || maxY === undefined) {
    return undefined
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

async function collectBoxes(page: PageLike, nodes: AxNode[]): Promise<BoxLookup> {
  const boxes: BoxLookup = new Map()
  for (const node of nodes) {
    if (node.backendDOMNodeId === undefined) {
      continue
    }
    try {
      const model = await page.cdp('page', 'DOM.getBoxModel', {
        backendNodeId: node.backendDOMNodeId,
      })
      const box = boxFromModel(model)
      if (box !== undefined) {
        boxes.set(node.backendDOMNodeId, box)
      }
    } catch {
      // Node may not have a box (display:none, detached). Skip it.
    }
  }
  return boxes
}

/**
 * Assembles an observe result from CDP (ax tree, frame loaderId, box models)
 * plus a screenshot. Pure enough to unit-test with a fake PageLike.
 */
export async function observePage(page: PageLike): Promise<ObserveResult> {
  const ax = await page.cdp('page', 'Accessibility.getFullAXTree')
  const frame = await page.cdp('page', 'Page.getFrameTree')
  const nodes = axNodesFrom(ax)
  const loaderId = loaderIdFrom(frame)
  const boxes = await collectBoxes(page, nodes)
  const snapshot = buildSnapshot(buildRawTree(nodes, boxes, loaderId))
  return {
    snapshot,
    image: await page.screenshot(),
    overlay: buildOverlay(snapshot),
  }
}
