import { describe, expect, it } from 'vitest'
import {
  SHOWCASE_ADD_COUNT,
  SHOWCASE_STEPS,
  SHOWCASE_TODO_TITLES,
  repeatClick,
  showcaseNavigations,
  todoFlowSteps,
} from '../../src/intent/showcaseFlow.js'

describe('SHOWCASE_STEPS', () => {
  it('is a long named flow across seven stable public pages', () => {
    expect(SHOWCASE_TODO_TITLES).toHaveLength(22)
    expect(SHOWCASE_ADD_COUNT).toBe(12)
    expect(SHOWCASE_STEPS).toHaveLength(98)
    expect(showcaseNavigations()).toEqual([
      'https://httpbin.org/forms/post',
      'https://the-internet.herokuapp.com/login',
      'https://the-internet.herokuapp.com/add_remove_elements/',
      'https://the-internet.herokuapp.com/forgot_password',
      'https://www.saucedemo.com/',
      'https://www.saucedemo.com/checkout-step-one.html',
      'https://demo.playwright.dev/todomvc/',
    ])
  })

  it('uses name-based type, click, hover, and press so the server can re-resolve', () => {
    const actions = new Set(SHOWCASE_STEPS.map((step) => step.action))
    expect(actions.has('navigate')).toBe(true)
    expect(actions.has('type')).toBe(true)
    expect(actions.has('click')).toBe(true)
    expect(actions.has('hover')).toBe(true)
    expect(actions.has('press')).toBe(true)
    for (const step of SHOWCASE_STEPS) {
      if (step.action === 'navigate') {
        expect(step.url).toMatch(/^https:\/\//)
        continue
      }
      if (step.action === 'press') {
        expect(step.key).toBeTruthy()
        continue
      }
      expect(step.uid).toBeUndefined()
      expect(step.name).toBeTruthy()
    }
  })

  it('covers a pizza form, a login, a three-item checkout, and todos', () => {
    const names = SHOWCASE_STEPS.flatMap((step) => (step.name === undefined ? [] : [step.name]))
    expect(names).toContain('Customer name')
    expect(names).toContain('Submit order')
    expect(names).toContain('Login')
    expect(names).toContain('Logout')
    expect(names).toContain('Add to cart')
    expect(names).toContain('First Name')
    expect(names).toContain('Finish')
    expect(names).toContain('What needs to be done?')
    expect(names).toContain('Add Element')
    expect(names).toContain('Retrieve password')
    expect(names).toContain('Sauce Labs Onesie')
    const nears = SHOWCASE_STEPS.flatMap((step) => (step.near === undefined ? [] : [step.near]))
    expect(nears).toEqual([
      'Products',
      'Backpack',
      'Products',
      'Bike Light',
      'Products',
      'Bolt T-Shirt',
      'Products',
      'Fleece Jacket',
      'Products',
      'Onesie',
      'Products',
      'allTheThings',
    ])
    const expects = SHOWCASE_STEPS.flatMap((step) =>
      step.expectUrl === undefined ? [] : [step.expectUrl],
    )
    expect(expects).toEqual(['/secure', '/login', '/inventory', '/checkout-complete', 'todomvc'])
  })
})

describe('todoFlowSteps', () => {
  it('emits a type and Enter for every title', () => {
    expect(todoFlowSteps(['One', 'Two'])).toEqual([
      { action: 'type', name: 'What needs to be done?', text: 'One' },
      { action: 'press', key: 'Enter' },
      { action: 'type', name: 'What needs to be done?', text: 'Two' },
      { action: 'press', key: 'Enter' },
    ])
  })
})

describe('repeatClick', () => {
  it('repeats a named click the given number of times', () => {
    expect(repeatClick('Add Element', 3)).toEqual([
      { action: 'click', name: 'Add Element' },
      { action: 'click', name: 'Add Element' },
      { action: 'click', name: 'Add Element' },
    ])
    expect(repeatClick('Add Element', 0)).toEqual([])
  })
})
