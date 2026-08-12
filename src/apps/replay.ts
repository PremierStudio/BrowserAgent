import type { ActionEntry } from '../actions/ActionLog.js'
import type { BoundingBox } from '../snapshot/a11ySnapshot.js'

/** A model-produced annotation overlaid on the replay. */
export interface ReplayAnnotation {
  uid: string
  label: string
  color: string
}

const MIME = 'text/html;profile=mcp-app'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function boxAttr(box: BoundingBox | undefined): string {
  if (box === undefined) {
    return ''
  }
  return ` data-box="${box.x},${box.y},${box.width},${box.height}"`
}

function renderStep(entry: ActionEntry): string {
  return `<li data-action="${escapeHtml(entry.action)}" data-uid="${escapeHtml(entry.uid)}" data-ts="${entry.timestamp}"${boxAttr(entry.box)}>${escapeHtml(entry.action)} ${escapeHtml(entry.uid)}</li>`
}

function renderAnnotation(annotation: ReplayAnnotation): string {
  return `<div data-annotation="${escapeHtml(annotation.uid)}" data-color="${escapeHtml(annotation.color)}">${escapeHtml(annotation.label)}</div>`
}

/**
 * Renders an MCP App HTML document that replays the semantic action log
 * as a scrubbable timeline with optional annotations.
 */
export function renderReplay(entries: ActionEntry[], annotations: ReplayAnnotation[] = []): string {
  const empty = entries.length === 0
  const steps = entries.map((entry) => renderStep(entry)).join('')
  const notes = annotations.map((annotation) => renderAnnotation(annotation)).join('')
  const body = empty
    ? '<p data-replay="empty">No actions recorded.</p>'
    : `<ol data-replay="timeline">${steps}</ol>`
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="mime" content="${MIME}"/>
<title>BrowserAgent replay</title>
<style>
  :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; }
  body { margin: 0; background: #0b1020; color: #e8eefc; }
  ol { list-style: none; padding: 1rem; }
  li { padding: 0.5rem 0.75rem; margin: 0.35rem 0; border-radius: 8px; background: #162036; animation: fade 0.4s ease both; }
  li[data-action="click"] { box-shadow: 0 0 0 2px #5b9dff; }
  li[data-action="hover"] { outline: 2px dashed #c084fc; }
  [data-annotation] { margin: 0.5rem 1rem; padding: 0.4rem 0.6rem; border-left: 4px solid currentColor; }
  [data-color="red"] { color: #ff6b6b; }
  @keyframes fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
</style>
</head>
<body>
${body}
${notes}
</body>
</html>`
}
