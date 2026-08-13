import { describe, expect, it } from 'vitest'
import type { ContextPage } from '../../src/context/ContextPage.js'
import type { FlowFile } from '../../src/intent/flowFile.js'
import { saveFlow } from '../../src/intent/flowFile.js'
import { runFlow } from '../../src/intent/runFlow.js'
import { runFlowFile } from '../../src/intent/runFlowFile.js'

function recordPage(): ContextPage & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    getElementByUid: async () => undefined,
    waitForEventsAfterAction: async () => undefined,
    observe: async () => ({
      snapshot: {
        uid: 'root',
        role: 'document',
        name: 'Home',
        children: [{ uid: 'go', role: 'button', name: 'Login' }],
      },
      image: '',
      overlay: {},
      pageState: { url: 'https://example.com/home', title: 'Home' },
    }),
    emulate: async () => undefined,
    getDialog: async () => null,
    click: async (uid) => {
      calls.push(`click:${uid}`)
    },
    type: async () => undefined,
    hover: async () => undefined,
    scroll: async () => undefined,
    select: async () => undefined,
    press: async () => undefined,
    navigate: async () => undefined,
  }
}

function mustSave(name: string, steps: Parameters<typeof saveFlow>[0]['steps']): FlowFile {
  const saved = saveFlow({ name, steps })
  if (!saved.ok) {
    throw new Error(saved.error)
  }
  return saved.file
}

describe('runFlowFile', () => {
  it('plays a durable file and reports the step count', async () => {
    const page = recordPage()
    const file = mustSave('login', [{ action: 'click', name: 'Login', expectText: 'Home' }])
    await expect(runFlowFile(page, file)).resolves.toEqual({
      ok: true,
      name: 'login',
      steps: 1,
    })
    expect(page.calls).toEqual(['click:go'])
  })

  it('refuses a file that fails durability rules', async () => {
    const page = recordPage()
    await expect(
      runFlowFile(page, {
        version: 1,
        name: 'bad',
        steps: [{ action: 'click', name: 'Login' }],
      }),
    ).rejects.toThrow(/requires expectUrl or expectText/)
  })

  it('prefixes a bind miss with the step number', async () => {
    const page = recordPage()
    const file = mustSave('login', [{ action: 'click', name: 'Nope', expectText: 'Home' }])
    await expect(runFlowFile(page, file)).rejects.toThrow(/step 1 click: no target/)
  })
})

describe('runFlow step errors', () => {
  it('prefixes an unknown action with its step number', async () => {
    const page = recordPage()
    await expect(runFlow(page, [{ action: 'explode', uid: 'x' }])).rejects.toThrow(
      /step 1 explode: unknown action: explode/,
    )
  })
})
