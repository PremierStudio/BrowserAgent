import { describe, expect, it } from 'vitest'
import { Response } from '../../src/tools/Response.js'

describe('Response', () => {
  it('starts empty and materializes an empty result', () => {
    const response = new Response()
    const result = response.materialize()
    expect(result).toEqual({})
    expect('snapshot' in result).toBe(false)
    expect('image' in result).toBe(false)
    expect('overlay' in result).toBe(false)
    expect('events' in result).toBe(false)
  })

  it('omits each field when it is not attached', () => {
    const response = new Response()
    response.attachSnapshot({ root: 'tree' })
    const result = response.materialize()
    expect('image' in result).toBe(false)
    expect('overlay' in result).toBe(false)
    expect('events' in result).toBe(false)
  })

  it('attaches a snapshot and includes it in the result', () => {
    const response = new Response()
    response.attachSnapshot({ root: 'tree' })
    expect(response.materialize()).toEqual({ snapshot: { root: 'tree' } })
  })

  it('attaches an image and includes it in the result', () => {
    const response = new Response()
    response.attachImage('data:image/png;base64,abc')
    expect(response.materialize()).toEqual({ image: 'data:image/png;base64,abc' })
  })

  it('attaches an overlay and includes it in the result', () => {
    const response = new Response()
    response.attachOverlay({ uid1: { x: 0, y: 0, width: 10, height: 10 } })
    expect(response.materialize()).toEqual({
      overlay: { uid1: { x: 0, y: 0, width: 10, height: 10 } },
    })
  })

  it('attaches events and includes them in the result', () => {
    const response = new Response()
    response.attachEvents([{ type: 'console', text: 'hi' }])
    expect(response.materialize()).toEqual({ events: [{ type: 'console', text: 'hi' }] })
  })

  it('combines multiple attachments into one result', () => {
    const response = new Response()
    response.attachSnapshot({ root: 'tree' })
    response.attachImage('img')
    response.attachOverlay({ uid1: { x: 0, y: 0, width: 1, height: 1 } })
    response.attachEvents([{ type: 'console', text: 'hi' }])
    expect(response.materialize()).toEqual({
      snapshot: { root: 'tree' },
      image: 'img',
      overlay: { uid1: { x: 0, y: 0, width: 1, height: 1 } },
      events: [{ type: 'console', text: 'hi' }],
    })
  })

  it('materialize returns a fresh object each call', () => {
    const response = new Response()
    response.attachImage('img')
    const first = response.materialize()
    const second = response.materialize()
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
  })
})
