import { describe, expect, it } from 'vitest'
import {
  acceptDialog,
  dialogFromPayload,
  DialogTracker,
  getPageDialog,
} from '../../src/context/dialogPage.js'
import type { PageLike } from '../../src/context/ContextPage.js'

interface CdpCall {
  session: string
  method: string
  params: unknown
}

function recordingPage(): PageLike & { cdpCalls: CdpCall[] } {
  const cdpCalls: CdpCall[] = []
  return {
    cdpCalls,
    accessibility: { snapshot: async () => ({}) },
    cdp: async (session, method, params) => {
      cdpCalls.push({ session, method, params })
      return {}
    },
    screenshot: async () => '',
    evaluate: async () => undefined,
    goto: async () => undefined,
    keyboardPress: async () => undefined,
  }
}

describe('dialogFromPayload', () => {
  it('returns null for non-records', () => {
    expect(dialogFromPayload(null)).toBeNull()
    expect(dialogFromPayload(undefined)).toBeNull()
    expect(dialogFromPayload('alert')).toBeNull()
    expect(dialogFromPayload(1)).toBeNull()
    expect(dialogFromPayload(true)).toBeNull()
  })

  it('returns null when type or message is missing or not a string', () => {
    expect(dialogFromPayload({})).toBeNull()
    expect(dialogFromPayload({ type: 'alert' })).toBeNull()
    expect(dialogFromPayload({ message: 'hi' })).toBeNull()
    expect(dialogFromPayload({ type: 1, message: 'hi' })).toBeNull()
    expect(dialogFromPayload({ type: 'alert', message: 1 })).toBeNull()
    expect(dialogFromPayload({ type: () => 1, message: 'hi' })).toBeNull()
    expect(dialogFromPayload({ type: 'alert', message: () => 1 })).toBeNull()
  })

  it('reads string type and message fields', () => {
    expect(dialogFromPayload({ type: 'alert', message: 'boom' })).toEqual({
      type: 'alert',
      message: 'boom',
    })
  })

  it('reads thunk type and message fields', () => {
    expect(
      dialogFromPayload({
        type: () => 'confirm',
        message: () => 'sure?',
      }),
    ).toEqual({ type: 'confirm', message: 'sure?' })
  })

  it('reads mixed string and thunk fields', () => {
    expect(dialogFromPayload({ type: 'prompt', message: () => 'name?' })).toEqual({
      type: 'prompt',
      message: 'name?',
    })
    expect(dialogFromPayload({ type: () => 'beforeunload', message: 'leave?' })).toEqual({
      type: 'beforeunload',
      message: 'leave?',
    })
  })

  it('accepts empty strings', () => {
    expect(dialogFromPayload({ type: '', message: '' })).toEqual({ type: '', message: '' })
  })
})

describe('DialogTracker', () => {
  it('starts with no dialog', () => {
    const tracker = new DialogTracker()
    expect(tracker.last()).toBeNull()
  })

  it('stores a valid opening payload', () => {
    const tracker = new DialogTracker()
    tracker.onOpening({ type: 'alert', message: 'hi' })
    expect(tracker.last()).toEqual({ type: 'alert', message: 'hi' })
  })

  it('stores thunk opening payloads', () => {
    const tracker = new DialogTracker()
    tracker.onOpening({ type: () => 'confirm', message: () => 'ok?' })
    expect(tracker.last()).toEqual({ type: 'confirm', message: 'ok?' })
  })

  it('ignores invalid payloads and keeps the previous dialog', () => {
    const tracker = new DialogTracker()
    tracker.onOpening({ type: 'alert', message: 'keep' })
    tracker.onOpening(null)
    tracker.onOpening({ type: 'nope' })
    expect(tracker.last()).toEqual({ type: 'alert', message: 'keep' })
  })

  it('replaces last with a later valid opening', () => {
    const tracker = new DialogTracker()
    tracker.onOpening({ type: 'alert', message: 'first' })
    tracker.onOpening({ type: 'prompt', message: 'second' })
    expect(tracker.last()).toEqual({ type: 'prompt', message: 'second' })
  })

  it('clear drops the stored dialog', () => {
    const tracker = new DialogTracker()
    tracker.onOpening({ type: 'alert', message: 'hi' })
    tracker.clear()
    expect(tracker.last()).toBeNull()
  })

  it('clear on an empty tracker stays empty', () => {
    const tracker = new DialogTracker()
    tracker.clear()
    expect(tracker.last()).toBeNull()
  })
})

describe('getPageDialog', () => {
  it('returns tracker.last()', () => {
    const tracker = new DialogTracker()
    expect(getPageDialog(tracker)).toBeNull()
    tracker.onOpening({ type: 'alert', message: 'x' })
    expect(getPageDialog(tracker)).toEqual({ type: 'alert', message: 'x' })
    expect(getPageDialog(tracker)).toBe(tracker.last())
    tracker.clear()
    expect(getPageDialog(tracker)).toBeNull()
  })
})

describe('acceptDialog', () => {
  it('handles a dialog without promptText', async () => {
    const page = recordingPage()
    await acceptDialog(page, true)
    expect(page.cdpCalls).toEqual([
      {
        session: 'page',
        method: 'Page.handleJavaScriptDialog',
        params: { accept: true },
      },
    ])
  })

  it('handles a dismissed dialog without promptText', async () => {
    const page = recordingPage()
    await acceptDialog(page, false)
    expect(page.cdpCalls[0]?.session).toBe('page')
    expect(page.cdpCalls[0]?.method).toBe('Page.handleJavaScriptDialog')
    expect(page.cdpCalls[0]?.params).toEqual({ accept: false })
  })

  it('includes promptText when provided', async () => {
    const page = recordingPage()
    await acceptDialog(page, true, 'typed')
    expect(page.cdpCalls).toEqual([
      {
        session: 'page',
        method: 'Page.handleJavaScriptDialog',
        params: { accept: true, promptText: 'typed' },
      },
    ])
  })

  it('includes an empty promptText rather than omitting it', async () => {
    const page = recordingPage()
    await acceptDialog(page, false, '')
    expect(page.cdpCalls[0]?.params).toEqual({ accept: false, promptText: '' })
  })
})
