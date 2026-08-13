import type { ActionEntry } from '../actions/ActionLog.js'
import type { BoundingBox } from '../snapshot/a11ySnapshot.js'

/** A model-produced annotation overlaid on the replay. */
export interface ReplayAnnotation {
  uid: string
  label: string
  color: string
}

const MIME = 'text/html;profile=mcp-app'

/** Player script embedded in the replay document. Exported so tests pin every line. */
export const REPLAY_SCRIPT = [
  '(function () {',
  "  var steps = document.querySelectorAll('[data-action]');",
  "  var scrubber = document.querySelector('[data-scrubber]');",
  "  var playBtn = document.querySelector('[data-play]');",
  "  var pauseBtn = document.querySelector('[data-pause]');",
  "  var cursor = document.querySelector('[data-cursor]');",
  "  var ripple = document.querySelector('[data-ripple]');",
  "  var hoverPulse = document.querySelector('[data-hover-pulse]');",
  "  var navFade = document.querySelector('[data-nav-fade]');",
  '  var playing = false;',
  '  var index = 0;',
  '  var timer = 0;',
  '  function clearFx() {',
  "    if (ripple) ripple.classList.remove('ripple');",
  "    if (hoverPulse) hoverPulse.classList.remove('pulse');",
  "    if (navFade) navFade.classList.remove('fade');",
  '  }',
  '  function activate(i) {',
  '    index = i;',
  '    for (var s = 0; s < steps.length; s += 1) {',
  '      var step = steps[s];',
  '      if (!step) continue;',
  "      if (s === i) step.setAttribute('data-active', '');",
  "      else step.removeAttribute('data-active');",
  '    }',
  '    if (scrubber) scrubber.value = String(i);',
  '    clearFx();',
  '    var current = steps[i];',
  '    if (!current) return;',
  "    var action = current.getAttribute('data-action');",
  "    var box = current.getAttribute('data-box');",
  '    if (box && cursor) {',
  "      var parts = box.split(',');",
  '      var x = parts[0];',
  '      var y = parts[1];',
  '      if (x && y) {',
  "        cursor.style.setProperty('--cx', x + 'px');",
  "        cursor.style.setProperty('--cy', y + 'px');",
  '      }',
  '    }',
  "    if (action === 'click' && ripple) ripple.classList.add('ripple');",
  "    if (action === 'hover' && hoverPulse) hoverPulse.classList.add('pulse');",
  "    if (action === 'navigate' && navFade) navFade.classList.add('fade');",
  '  }',
  '  function stopPlay() {',
  '    playing = false;',
  '    if (timer) {',
  '      clearTimeout(timer);',
  '      timer = 0;',
  '    }',
  '  }',
  '  function walk() {',
  '    if (!playing) return;',
  '    if (index >= steps.length) {',
  '      stopPlay();',
  '      return;',
  '    }',
  '    activate(index);',
  '    index += 1;',
  '    timer = setTimeout(walk, 600);',
  '  }',
  '  if (scrubber) {',
  "    scrubber.addEventListener('input', function () {",
  '      stopPlay();',
  '      activate(Number(scrubber.value));',
  '    });',
  '  }',
  '  if (playBtn) {',
  "    playBtn.addEventListener('click', function () {",
  '      if (playing) return;',
  '      playing = true;',
  '      if (index >= steps.length) index = 0;',
  '      walk();',
  '    });',
  '  }',
  '  if (pauseBtn) {',
  "    pauseBtn.addEventListener('click', function () {",
  '      stopPlay();',
  '    });',
  '  }',
  '})();',
].join('\n')

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
  const lastIndex = Math.max(0, entries.length - 1)
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
<title>BrowserEngine replay</title>
<style>
  :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; }
  body { margin: 0; background: #0b1020; color: #e8eefc; }
  .stage { position: relative; height: 12rem; margin: 1rem; border-radius: 12px; background: #11182b; overflow: hidden; }
  [data-cursor] { position: absolute; width: 14px; height: 14px; border-radius: 50%; background: #e8eefc; box-shadow: 0 0 0 3px #5b9dff; animation: cursor-move 0.45s ease both; }
  [data-ripple] { position: absolute; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #5b9dff; opacity: 0; }
  [data-ripple].ripple { animation: click-ripple 0.5s ease-out; }
  [data-hover-pulse] { position: absolute; inset: 1rem; border-radius: 10px; outline: 2px dashed #c084fc; opacity: 0; }
  [data-hover-pulse].pulse { animation: hover-pulse 0.55s ease; }
  [data-nav-fade] { position: absolute; inset: 0; background: #0b1020; opacity: 0; pointer-events: none; }
  [data-nav-fade].fade { animation: nav-fade 0.5s ease; }
  .controls { display: flex; gap: 0.5rem; align-items: center; padding: 0 1rem; }
  [data-scrubber] { flex: 1; }
  ol { list-style: none; padding: 1rem; }
  li { padding: 0.5rem 0.75rem; margin: 0.35rem 0; border-radius: 8px; background: #162036; }
  li[data-action="click"] { box-shadow: 0 0 0 2px #5b9dff; }
  li[data-action="hover"] { outline: 2px dashed #c084fc; }
  li[data-active] { background: #243656; }
  [data-annotation] { margin: 0.5rem 1rem; padding: 0.4rem 0.6rem; border-left: 4px solid currentColor; }
  [data-color="red"] { color: #ff6b6b; }
  @keyframes cursor-move { from { transform: translate(8px, 8px); } to { transform: translate(var(--cx, 48px), var(--cy, 48px)); } }
  @keyframes click-ripple { from { transform: scale(0.4); opacity: 0.9; } to { transform: scale(6); opacity: 0; } }
  @keyframes hover-pulse { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.7; } }
  @keyframes nav-fade { 0% { opacity: 0; } 40% { opacity: 0.85; } 100% { opacity: 0; } }
</style>
</head>
<body>
<div class="stage">
<span data-cursor></span>
<span data-ripple></span>
<span data-hover-pulse></span>
<span data-nav-fade></span>
</div>
<div class="controls">
<input type="range" data-scrubber min="0" max="${lastIndex}" value="0"/>
<button type="button" data-play>Play</button>
<button type="button" data-pause>Pause</button>
</div>
${body}
${notes}
<script>
${REPLAY_SCRIPT}
</script>
</body>
</html>`
}
