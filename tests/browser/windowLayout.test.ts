import { describe, expect, it } from 'vitest'
import {
  LAYOUT_SLACK_PX,
  WindowLayoutTracker,
  layoutsDiffer,
  parseWindowLayout,
  type WindowLayout,
} from '../../src/browser/windowLayout.js'

const snap: WindowLayout = {
  x: 0,
  y: 40,
  width: 1280,
  height: 1366,
  viewportWidth: 1278,
  viewportHeight: 1300,
}

describe('parseWindowLayout', () => {
  it('reads outer bounds and inner viewport', () => {
    expect(parseWindowLayout(snap)).toEqual(snap)
  })

  it('rejects missing, non-records, non-finite values, and non-positive sizes', () => {
    expect(parseWindowLayout(undefined)).toBeUndefined()
    expect(parseWindowLayout(null)).toBeUndefined()
    expect(parseWindowLayout('nope')).toBeUndefined()
    expect(parseWindowLayout({ ...snap, x: '0' })).toBeUndefined()
    expect(parseWindowLayout({ ...snap, y: Number.NaN })).toBeUndefined()
    expect(parseWindowLayout({ ...snap, x: Number.POSITIVE_INFINITY })).toBeUndefined()
    expect(parseWindowLayout({ ...snap, width: Number.NEGATIVE_INFINITY })).toBeUndefined()
    expect(parseWindowLayout({ ...snap, width: 0 })).toBeUndefined()
    expect(parseWindowLayout({ ...snap, height: 0 })).toBeUndefined()
    expect(parseWindowLayout({ ...snap, height: -1 })).toBeUndefined()
    expect(parseWindowLayout({ ...snap, viewportWidth: 0 })).toBeUndefined()
    expect(parseWindowLayout({ ...snap, viewportHeight: 0 })).toBeUndefined()
    expect(parseWindowLayout({ ...snap, viewportHeight: -2 })).toBeUndefined()
    expect(parseWindowLayout({ ...snap, width: undefined })).toBeUndefined()
    expect(parseWindowLayout({ ...snap, height: undefined })).toBeUndefined()
    expect(parseWindowLayout({ ...snap, viewportWidth: undefined })).toBeUndefined()
    expect(parseWindowLayout({ ...snap, viewportHeight: undefined })).toBeUndefined()
    expect(parseWindowLayout({ x: 0, y: 0, width: 10, height: 10 })).toBeUndefined()
  })
})

describe('layoutsDiffer', () => {
  it('ignores jitter within the slack and treats exact slack as unchanged', () => {
    expect(layoutsDiffer(snap, { ...snap, width: snap.width + LAYOUT_SLACK_PX })).toBe(false)
    expect(layoutsDiffer(snap, { ...snap, height: snap.height + LAYOUT_SLACK_PX })).toBe(false)
    expect(layoutsDiffer(snap, { ...snap, x: snap.x + LAYOUT_SLACK_PX })).toBe(false)
    expect(layoutsDiffer(snap, { ...snap, y: snap.y + LAYOUT_SLACK_PX })).toBe(false)
    expect(
      layoutsDiffer(snap, { ...snap, viewportWidth: snap.viewportWidth + LAYOUT_SLACK_PX }),
    ).toBe(false)
    expect(
      layoutsDiffer(snap, { ...snap, viewportHeight: snap.viewportHeight + LAYOUT_SLACK_PX }),
    ).toBe(false)
  })

  it('detects a change on every axis past slack', () => {
    const past = LAYOUT_SLACK_PX + 1
    expect(layoutsDiffer(snap, { ...snap, x: snap.x + past })).toBe(true)
    expect(layoutsDiffer(snap, { ...snap, y: snap.y + past })).toBe(true)
    expect(layoutsDiffer(snap, { ...snap, width: snap.width + past })).toBe(true)
    expect(layoutsDiffer(snap, { ...snap, height: snap.height + past })).toBe(true)
    expect(layoutsDiffer(snap, { ...snap, viewportWidth: snap.viewportWidth + past })).toBe(true)
    expect(layoutsDiffer(snap, { ...snap, viewportHeight: snap.viewportHeight + past })).toBe(true)
  })
})

describe('WindowLayoutTracker', () => {
  it('treats the first sample as a baseline, not a user resize', () => {
    const tracker = new WindowLayoutTracker()
    expect(tracker.sync(snap)).toEqual({ layout: snap, resized: false })
  })

  it('reports a later snap-right or grow as a user resize', () => {
    const tracker = new WindowLayoutTracker()
    tracker.sync(snap)
    const right: WindowLayout = { ...snap, x: 1280 }
    expect(tracker.sync(right)).toEqual({ layout: right, resized: true })
    const taller: WindowLayout = { ...right, height: 900 }
    expect(tracker.sync(taller)).toEqual({ layout: taller, resized: true })
    expect(tracker.sync({ ...taller, height: taller.height + 1 })).toEqual({
      layout: { ...taller, height: taller.height + 1 },
      resized: false,
    })
  })
})
