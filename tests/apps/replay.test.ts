import { describe, expect, it } from 'vitest'
import { renderReplay } from '../../src/apps/replay.js'
import type { ActionEntry } from '../../src/actions/ActionLog.js'

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
      [{ action: '<script>', uid: 'a&b', timestamp: 1 }],
      [{ uid: 'a&b', label: '<img>', color: 'red' }],
    )
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;img&gt;')
    expect(html).toContain('a&amp;b')
  })
})
