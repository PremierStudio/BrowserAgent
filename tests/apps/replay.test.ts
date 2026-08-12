import { describe, expect, it } from 'vitest'
import { renderReplay } from '../../src/apps/replay.js'
import type { ActionEntry } from '../../src/actions/ActionLog.js'

function scrubberTag(html: string): string {
  const match = html.match(/<input\b[^>]*\bdata-scrubber\b[^>]*>/)
  return match === null ? '' : match[0]
}

describe('renderReplay', () => {
  it('renders an empty timeline', () => {
    const html = renderReplay([])
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('data-replay="empty"')
    expect(html).toContain('text/html;profile=mcp-app')
  })

  it('renders each action as a timeline step', () => {
    const entries: ActionEntry[] = [
      { action: 'navigate', uid: '', timestamp: 1 },
      { action: 'click', uid: 'btn-1', timestamp: 2, box: { x: 10, y: 20, width: 80, height: 24 } },
      { action: 'type', uid: 'in-1', timestamp: 3 },
    ]
    const html = renderReplay(entries)
    expect(html).toContain('data-replay="timeline"')
    expect(html).toContain('data-action="navigate"')
    expect(html).toContain('data-action="click"')
    expect(html).toContain('data-action="type"')
    expect(html).toContain('data-uid="btn-1"')
    expect(html).toContain('data-box="10,20,80,24"')
    expect(html).toContain('data-ts="2"')
    expect(html).not.toMatch(/data-action="navigate"[^>]*data-box=/)
  })

  it('renders annotations as callouts', () => {
    const html = renderReplay(
      [{ action: 'click', uid: 'btn-1', timestamp: 1 }],
      [{ uid: 'btn-1', label: 'broken submit', color: 'red' }],
    )
    expect(html).toContain('data-annotation="btn-1"')
    expect(html).toContain('broken submit')
    expect(html).toContain('data-color="red"')
  })

  it('escapes HTML in action names and annotation labels', () => {
    const html = renderReplay(
      [{ action: '<script>', uid: 'a&b"c', timestamp: 1 }],
      [{ uid: 'a&b"c', label: '<img>', color: 'red' }],
    )
    expect(html).not.toContain('data-action="<script>"')
    expect(html).not.toContain('<img>')
    expect(html).toContain('data-action="&lt;script&gt;"')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;img&gt;')
    expect(html).toContain('a&amp;b&quot;c')
  })

  it('includes a stage with cursor, ripple, hover pulse, and nav fade', () => {
    const html = renderReplay([])
    expect(html).toContain('data-cursor')
    expect(html).toContain('data-ripple')
    expect(html).toContain('data-hover-pulse')
    expect(html).toContain('data-nav-fade')
  })

  it('includes a range scrubber and play/pause controls for an empty log', () => {
    const html = renderReplay([])
    const tag = scrubberTag(html)
    expect(tag).toContain('type="range"')
    expect(tag).toContain('data-scrubber')
    expect(tag).toContain('min="0"')
    expect(tag).toContain('max="0"')
    expect(html).toContain('data-play')
    expect(html).toContain('data-pause')
  })

  it('sets the scrubber max to the last step index', () => {
    const entries: ActionEntry[] = [
      { action: 'navigate', uid: '', timestamp: 1 },
      { action: 'hover', uid: 'btn-1', timestamp: 2 },
      { action: 'click', uid: 'btn-1', timestamp: 3 },
    ]
    const html = renderReplay(entries)
    const tag = scrubberTag(html)
    expect(tag).toContain('type="range"')
    expect(tag).toContain('min="0"')
    expect(tag).toContain('max="2"')
    expect(html).toContain('data-play')
    expect(html).toContain('data-pause')
  })

  it('declares eased cursor-move and effect keyframes', () => {
    const html = renderReplay([])
    expect(html).toMatch(/@keyframes\s+cursor-move/)
    expect(html).toMatch(/@keyframes\s+click-ripple/)
    expect(html).toMatch(/@keyframes\s+hover-pulse/)
    expect(html).toMatch(/@keyframes\s+nav-fade/)
    expect(html).toMatch(/cursor-move[^{;\n]*(ease|cubic-bezier)/)
    expect(html).not.toMatch(/animation:\s*cursor-move[^{;\n]*\blinear\b/)
  })

  it('embeds a script that scrubs, plays, and triggers action effects', () => {
    const html = renderReplay([
      { action: 'navigate', uid: '', timestamp: 1 },
      { action: 'hover', uid: 'n-1', timestamp: 2 },
      { action: 'click', uid: 'n-1', timestamp: 3 },
    ])
    expect(html).toMatch(/<script>/)
    expect(html).toMatch(/querySelectorAll\(\s*['"]\[data-action\]['"]\s*\)/)
    expect(html).toMatch(/addEventListener\(\s*['"]input['"]/)
    expect(html).toContain('data-active')
    expect(html).toContain('data-play')
    expect(html).toContain('data-pause')
    expect(html).toContain('classList.add')
    expect(html).toMatch(/['"]click['"][\s\S]{0,200}ripple|ripple[\s\S]{0,200}['"]click['"]/)
    expect(html).toMatch(/['"]hover['"][\s\S]{0,200}pulse|pulse[\s\S]{0,200}['"]hover['"]/)
    expect(html).toMatch(/['"]navigate['"][\s\S]{0,200}fade|fade[\s\S]{0,200}['"]navigate['"]/)
    expect(html).toMatch(/setTimeout|requestAnimationFrame/)
    expect(html).toMatch(/playing\s*=\s*false|clearTimeout|cancelAnimationFrame/)
    expect(html).not.toMatch(/\beval\s*\(/)
    expect(html).not.toMatch(/new\s+Function\s*\(/)
  })
})
