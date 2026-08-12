import { describe, expect, it } from 'vitest'
import {
  PuppeteerContextPage,
  type ContextPage,
  type PageLike,
} from '../../src/context/ContextPage.js'

function makeMockPage(): PageLike {
  return {
    accessibility: {
      snapshot: async () => ({ root: 'tree' }),
    },
    cdp: async (_session, method) => {
      if (method === 'DOM.resolveNode') {
        return { object: { objectId: 'obj-1' } }
      }
      return {}
    },
    screenshot: async () => 'data:image/png;base64,abc',
    evaluate: async () => ({}),
    goto: async () => undefined,
    keyboardPress: async () => undefined,
  }
}

describe('PuppeteerContextPage', () => {
  it('implements the ContextPage interface', () => {
    const page = makeMockPage()
    const context: ContextPage = new PuppeteerContextPage(page)
    expect(context).toBeDefined()
  })

  it('observe returns a snapshot, image and overlay', async () => {
    const page = makeMockPage()
    const context = new PuppeteerContextPage(page)
    const result = await context.observe()
    expect(result.snapshot.role).toBe('generic')
    expect(result.image).toBe('data:image/png;base64,abc')
    expect(result.overlay).toEqual({})
  })

  it('getElementByUid resolves an element by uid', async () => {
    const page = makeMockPage()
    const context = new PuppeteerContextPage(page)
    const element = await context.getElementByUid('loader-1_42')
    expect(element).toEqual({ uid: 'loader-1_42', backendNodeId: 42 })
  })

  it('getElementByUid throws for an invalid uid', async () => {
    const page = makeMockPage()
    const context = new PuppeteerContextPage(page)
    await expect(context.getElementByUid('not-a-uid')).rejects.toThrow(/invalid uid/i)
  })

  it('waitForEventsAfterAction resolves', async () => {
    const page = makeMockPage()
    const context = new PuppeteerContextPage(page)
    await expect(context.waitForEventsAfterAction()).resolves.toBeUndefined()
  })

  it('emulate resolves', async () => {
    const page = makeMockPage()
    const context = new PuppeteerContextPage(page)
    await expect(context.emulate({})).resolves.toBeUndefined()
  })

  it('getDialog returns null when no dialog is present', async () => {
    const page = makeMockPage()
    const context = new PuppeteerContextPage(page)
    expect(await context.getDialog()).toBeNull()
  })

  it('action methods resolve', async () => {
    const page = makeMockPage()
    const context = new PuppeteerContextPage(page)
    await expect(context.click('loader-1_1')).resolves.toBeUndefined()
    await expect(context.type('loader-1_1', 'hi')).resolves.toBeUndefined()
    await expect(context.hover('loader-1_1')).resolves.toBeUndefined()
    await expect(context.scroll('loader-1_1', 1, 2)).resolves.toBeUndefined()
    await expect(context.select('loader-1_1', 'v')).resolves.toBeUndefined()
    await expect(context.press('Enter')).resolves.toBeUndefined()
    await expect(context.navigate('https://example.com')).resolves.toBeUndefined()
  })
})
