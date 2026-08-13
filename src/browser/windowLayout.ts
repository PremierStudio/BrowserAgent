/** Ignore 2px DWM / snap jitter so a real user drag is the check that fires. */
export const LAYOUT_SLACK_PX = 2

export type WindowLayout = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly viewportWidth: number
  readonly viewportHeight: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function finiteNumber(value: unknown): number | undefined {
  if (!Number.isFinite(value)) {
    return undefined
  }
  return Number(value)
}

/** Parse outer window bounds plus the inner viewport. */
export function parseWindowLayout(value: unknown): WindowLayout | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const x = finiteNumber(value.x)
  const y = finiteNumber(value.y)
  const width = finiteNumber(value.width)
  const height = finiteNumber(value.height)
  const viewportWidth = finiteNumber(value.viewportWidth)
  const viewportHeight = finiteNumber(value.viewportHeight)
  if (
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined ||
    viewportWidth === undefined ||
    viewportHeight === undefined
  ) {
    return undefined
  }
  if (width <= 0 || height <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return undefined
  }
  return { x, y, width, height, viewportWidth, viewportHeight }
}

/** True when any axis moved more than slack pixels. */
export function layoutsDiffer(
  a: WindowLayout,
  b: WindowLayout,
  slack: number = LAYOUT_SLACK_PX,
): boolean {
  return (
    Math.abs(a.x - b.x) > slack ||
    Math.abs(a.y - b.y) > slack ||
    Math.abs(a.width - b.width) > slack ||
    Math.abs(a.height - b.height) > slack ||
    Math.abs(a.viewportWidth - b.viewportWidth) > slack ||
    Math.abs(a.viewportHeight - b.viewportHeight) > slack
  )
}

/** Remembers the last live window so a later user drag is a resize. */
export class WindowLayoutTracker {
  private previous: WindowLayout | undefined

  sync(current: WindowLayout): { layout: WindowLayout; resized: boolean } {
    const resized = this.previous !== undefined && layoutsDiffer(this.previous, current)
    this.previous = current
    return { layout: current, resized }
  }
}
