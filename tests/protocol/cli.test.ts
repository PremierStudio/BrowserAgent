import { describe, expect, it } from 'vitest'
import { buildCliMain, type Serve } from '../../src/protocol/cli.js'

describe('buildCliMain', () => {
  it('creates a main that serves via the provided serve function', () => {
    let factory: (() => unknown) | undefined
    let served = false
    const serve: Serve = (f) => {
      factory = f
      served = true
      return { close: async () => undefined }
    }
    const main = buildCliMain(serve)
    main()
    expect(served).toBe(true)
    expect(typeof factory).toBe('function')
  })

  it('the factory returns a server built from the standard tool set', () => {
    let factory: (() => unknown) | undefined
    const serve: Serve = (f) => {
      factory = f
      return { close: async () => undefined }
    }
    const main = buildCliMain(serve)
    main()
    const server = factory?.()
    expect(server).toBeDefined()
  })
})
