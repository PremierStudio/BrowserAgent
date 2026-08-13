import { describe, expect, it } from 'vitest'
import {
  clickHudDeclaration,
  hoverHudDeclaration,
  pressHudEvaluate,
  scrollHudDeclaration,
  selectHudDeclaration,
  selectOptionSource,
  typeHudCharDeclaration,
  typeHudCommitDeclaration,
  typeHudFocusDeclaration,
} from '../../src/browser/actionHud.js'
import * as snap from './actionHud.scripts.js'

type SelectOption = { value: string; text: string; label: string }

function recordingSelect(
  options: readonly SelectOption[],
  selectedIndex: number,
  value: string,
  events: string[],
): {
  options: readonly SelectOption[]
  selectedIndex: number
  value: string
  events: string[]
  dispatchEvent: (ev: { type: string }) => boolean
} {
  return {
    options,
    selectedIndex,
    value,
    events,
    dispatchEvent(ev: { type: string }) {
      events.push(ev.type)
      return true
    },
  }
}

describe('actionHud', () => {
  it('pins every live HUD script so a person sees cursor, type, and keys', () => {
    expect(clickHudDeclaration()).toBe(snap.click)
    expect(hoverHudDeclaration()).toBe(snap.hover)
    expect(scrollHudDeclaration(3, 40)).toBe(snap.scroll)
    expect(selectHudDeclaration('opt')).toBe(snap.select)
    expect(pressHudEvaluate('PageDown')).toBe(snap.pressPageDown)
    expect(pressHudEvaluate('PageUp')).toBe(snap.pressPageUp)
    expect(pressHudEvaluate('Space')).toBe(snap.pressSpace)
    expect(pressHudEvaluate('Enter')).toBe(snap.pressEnter)
    expect(typeHudFocusDeclaration()).toBe(snap.typeFocus)
    expect(typeHudCharDeclaration('h')).toBe(snap.typeChar)
    expect(typeHudCommitDeclaration()).toBe(snap.typeCommit)
  })

  it('picks a select option by visible label when the value is an id', () => {
    const events: string[] = []
    const box = recordingSelect(
      [
        { value: '', text: '---Your Name---', label: '---Your Name---' },
        { value: 'number:2', text: 'Harry Potter', label: 'Harry Potter' },
      ],
      0,
      '',
      events,
    )
    const run = new Function(selectOptionSource('Harry Potter'))
    run.call(box)
    expect(box.selectedIndex).toBe(1)
    expect(events).toEqual(['input', 'change'])
    expect(selectHudDeclaration('Harry Potter')).toContain(selectOptionSource('Harry Potter'))
  })

  it('keeps a value match when the label is different', () => {
    const box = recordingSelect(
      [{ value: '2', text: 'Harry Potter', label: 'Harry Potter' }],
      -1,
      '',
      [],
    )
    new Function(selectOptionSource('2')).call(box)
    expect(box.selectedIndex).toBe(0)
  })

  it('writes the raw value when no option matches or options are missing', () => {
    const bareEvents: string[] = []
    const bare = {
      value: '',
      events: bareEvents,
      dispatchEvent(ev: { type: string }) {
        bareEvents.push(ev.type)
        return true
      },
    }
    new Function(selectOptionSource('Harry Potter')).call(bare)
    expect(bare.value).toBe('Harry Potter')
    const empty = recordingSelect(
      [{ value: '1', text: 'Hermoine Granger', label: 'Hermoine Granger' }],
      0,
      '1',
      [],
    )
    new Function(selectOptionSource('Harry Potter')).call(empty)
    expect(empty.value).toBe('Harry Potter')
    expect(empty.selectedIndex).toBe(0)
  })

  it('matches a visible label by substring and by the label field', () => {
    const sub = {
      options: [{ value: '9', text: 'Harry Potter', label: 'Harry Potter' }],
      selectedIndex: -1,
      dispatchEvent() {
        return true
      },
    }
    new Function(selectOptionSource('Harry')).call(sub)
    expect(sub.selectedIndex).toBe(0)
    const labeled = {
      options: [{ value: '9', text: '', label: 'Harry Potter' }],
      selectedIndex: -1,
      dispatchEvent() {
        return true
      },
    }
    new Function(selectOptionSource('Harry Potter')).call(labeled)
    expect(labeled.selectedIndex).toBe(0)
  })

  it('skips Angular when element or triggerHandler is missing', () => {
    const host = globalThis
    const hadAngular = Reflect.has(host, 'angular')
    const previous = Reflect.get(host, 'angular')
    const box = {
      options: [{ value: '2', text: 'Harry Potter', label: 'Harry Potter' }],
      selectedIndex: -1,
      dispatchEvent() {
        return true
      },
    }
    try {
      Reflect.set(host, 'angular', {})
      expect(() => new Function(selectOptionSource('Harry Potter')).call(box)).not.toThrow()
      Reflect.set(host, 'angular', { element: () => ({}) })
      expect(() => new Function(selectOptionSource('Harry Potter')).call(box)).not.toThrow()
    } finally {
      if (hadAngular) {
        Reflect.set(host, 'angular', previous)
      } else {
        Reflect.deleteProperty(host, 'angular')
      }
    }
  })

  it('does not treat an empty want as a substring hit', () => {
    const box = recordingSelect(
      [{ value: '2', text: 'Harry Potter', label: 'Harry Potter' }],
      -1,
      '',
      [],
    )
    new Function(selectOptionSource('')).call(box)
    expect(box.selectedIndex).toBe(-1)
    expect(box.value).toBe('')
  })

  it('notifies Angular when the page exposes it', () => {
    const triggered: string[] = []
    const host = globalThis
    const hadAngular = Reflect.has(host, 'angular')
    const previous = Reflect.get(host, 'angular')
    Reflect.set(host, 'angular', {
      element: () => ({
        triggerHandler: (name: string) => {
          triggered.push(name)
        },
      }),
    })
    try {
      new Function(selectOptionSource('Harry Potter')).call({
        options: [{ value: '2', text: 'Harry Potter', label: 'Harry Potter' }],
        selectedIndex: -1,
        dispatchEvent() {
          return true
        },
      })
    } finally {
      if (hadAngular) {
        Reflect.set(host, 'angular', previous)
      } else {
        Reflect.deleteProperty(host, 'angular')
      }
    }
    expect(triggered).toEqual(['change'])
  })
})
