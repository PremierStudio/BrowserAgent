import { describe, expect, it } from 'vitest'
import {
  BIND_CANDIDATE_LIMIT,
  bindTarget,
  formatBindFailure,
  namesMatch,
  resolveTarget,
} from '../../src/intent/resolveTarget.js'
import type { OutlineItem } from '../../src/snapshot/outline.js'

const shop: OutlineItem[] = [
  { uid: 'user', role: 'textbox', name: 'Username' },
  { uid: 'pass', role: 'textbox', name: 'Password' },
  { uid: 'login', role: 'button', name: 'Login' },
  { uid: 'bp', role: 'link', name: 'Sauce Labs Backpack' },
  { uid: 'add1', role: 'button', name: 'Add to cart' },
  { uid: 'bl', role: 'link', name: 'Sauce Labs Bike Light' },
  { uid: 'add2', role: 'button', name: 'Add to cart' },
]

const loginPage: OutlineItem[] = [
  { uid: 'h1', role: 'heading', name: 'Login Page' },
  {
    uid: 'help',
    role: 'heading',
    name: 'Enter tomsmith for the username and SuperSecretPassword! for the password.',
  },
  { uid: 'user', role: 'textbox', name: 'Username' },
  { uid: 'pass', role: 'textbox', name: 'Password' },
  { uid: 'go', role: 'button', name: ' Login' },
]

describe('namesMatch', () => {
  it('matches exact, case-insensitive, and substring names', () => {
    expect(namesMatch('Username', 'Username')).toBe(true)
    expect(namesMatch('Username', 'username')).toBe(true)
    expect(namesMatch('Username', '  username  ')).toBe(true)
    expect(namesMatch('Sauce Labs Backpack', 'Backpack')).toBe(true)
    expect(namesMatch('Add to cart', 'cart')).toBe(true)
    expect(namesMatch(' Products', 'Products')).toBe(true)
    expect(namesMatch(' View Product', 'View Product')).toBe(true)
    expect(namesMatch('FEATURES ITEMS', 'Features Items')).toBe(true)
  })

  it('rejects empty queries and unrelated names', () => {
    expect(namesMatch('Username', '')).toBe(false)
    expect(namesMatch('Username', '   ')).toBe(false)
    expect(namesMatch('', 'Username')).toBe(false)
    expect(namesMatch('Login', 'Password')).toBe(false)
  })
})

describe('resolveTarget', () => {
  it('prefers an explicit uid', () => {
    expect(resolveTarget(shop, { uid: 'login', name: 'Password' })).toBe('login')
    expect(bindTarget(shop, { uid: 'login', name: 'Password' })).toEqual({
      status: 'bound',
      uid: 'login',
      candidates: [],
    })
  })

  it('binds a unique name and refuses a tied name', () => {
    expect(resolveTarget(shop, { name: 'Username' })).toBe('user')
    expect(resolveTarget(shop, { name: 'Add to cart' })).toBeUndefined()
  })

  it('filters by role when given', () => {
    expect(resolveTarget(shop, { name: 'Backpack', role: 'link' })).toBe('bp')
    expect(resolveTarget(shop, { name: 'Backpack', role: 'button' })).toBeUndefined()
  })

  it('uses near to pick the closest control after a landmark name', () => {
    expect(resolveTarget(shop, { name: 'Add to cart', near: 'Bike Light' })).toBe('add2')
    expect(resolveTarget(shop, { name: 'Add to cart', near: 'Backpack' })).toBe('add1')
    expect(resolveTarget(shop, { name: 'Password', near: 'Username' })).toBe('pass')
  })

  it('types into the field, not a heading that mentions the word', () => {
    expect(resolveTarget(loginPage, { name: 'Username', action: 'type' })).toBe('user')
    expect(resolveTarget(loginPage, { name: 'Password', action: 'type' })).toBe('pass')
  })

  it('types the field when a heading has the same exact name', () => {
    const items: OutlineItem[] = [
      { uid: 'h', role: 'heading', name: 'Username' },
      { uid: 'user', role: 'textbox', name: 'Username' },
    ]
    expect(resolveTarget(items, { name: 'Username', action: 'type' })).toBe('user')
    expect(resolveTarget(items, { name: 'Username' })).toBeUndefined()
  })

  it('clicks the button, not a heading that starts with the same word', () => {
    expect(resolveTarget(loginPage, { name: 'Login', action: 'click' })).toBe('go')
  })

  it('prefers an exact name over a longer substring hit', () => {
    expect(resolveTarget(loginPage, { name: 'Login' })).toBe('go')
    expect(resolveTarget(loginPage, { name: 'Login Page' })).toBe('h1')
  })

  it('does not let a click bind a button from context alone', () => {
    const items: OutlineItem[] = [
      { uid: 'home', role: 'button', name: 'Home', context: 'Your Name :' },
    ]
    expect(resolveTarget(items, { action: 'click', name: 'Your Name' })).toBeUndefined()
  })

  it('types an unlabeled amount field from its nearby label', () => {
    expect(
      resolveTarget(
        [
          {
            uid: 'amt',
            role: 'spinbutton',
            name: '',
            value: '',
            context: 'Amount to be Deposited :',
          },
        ],
        { action: 'type', name: 'Amount to be Deposited' },
      ),
    ).toBe('amt')
  })

  it('types into a spinbutton labeled Amount to be Deposited', () => {
    const items: OutlineItem[] = [
      { uid: 'lab', role: 'StaticText', name: 'Amount to be Deposited :' },
      { uid: 'amt', role: 'spinbutton', name: 'Amount to be Deposited :', value: '' },
      { uid: 'go', role: 'button', name: 'Deposit', context: 'Amount to be Deposited :' },
    ]
    expect(resolveTarget(items, { action: 'type', name: 'Amount to be Deposited' })).toBe('amt')
    expect(
      resolveTarget(items, {
        action: 'click',
        name: 'Deposit',
        near: 'Amount to be Deposited',
      }),
    ).toBe('go')
  })

  it('selects an unlabeled combobox from its value or nearby label', () => {
    const items: OutlineItem[] = [
      { uid: 'home', role: 'button', name: 'Home' },
      {
        uid: 'sel',
        role: 'combobox',
        name: '',
        value: '---Your Name---',
        context: 'Your Name :',
      },
    ]
    expect(resolveTarget(items, { action: 'select', name: 'Your Name' })).toBe('sel')
    expect(
      resolveTarget([{ uid: 'sel', role: 'combobox', name: '', value: '---Your Name---' }], {
        action: 'select',
        name: 'Your Name',
      }),
    ).toBe('sel')
  })

  it('hover and select stay on controls, not headings', () => {
    expect(resolveTarget(loginPage, { name: 'Login', action: 'hover' })).toBe('go')
    expect(resolveTarget(shop, { name: 'Username', action: 'select' })).toBeUndefined()
    expect(resolveTarget(shop, { name: 'Login', action: 'select' })).toBeUndefined()
    expect(
      resolveTarget(
        [
          { uid: 'h', role: 'heading', name: 'Save' },
          { uid: 'b', role: 'button', name: 'Save' },
        ],
        { name: 'Save', action: 'hover' },
      ),
    ).toBe('b')
    expect(
      resolveTarget([{ uid: 'sel', role: 'combobox', name: 'Country' }], {
        name: 'Country',
        action: 'select',
      }),
    ).toBe('sel')
  })

  it('returns undefined when nothing matches', () => {
    expect(resolveTarget(shop, {})).toBeUndefined()
    expect(bindTarget(shop, {})).toEqual({ status: 'none', uid: undefined, candidates: [] })
    expect(resolveTarget(shop, { name: 'Checkout' })).toBeUndefined()
    expect(resolveTarget(shop, { name: 'Add to cart', near: 'Fleece' })).toBeUndefined()
    expect(resolveTarget([], { name: 'Login' })).toBeUndefined()
  })
})

describe('bindTarget', () => {
  it('binds a unique name with that single candidate', () => {
    expect(bindTarget(shop, { name: 'Username' })).toEqual({
      status: 'bound',
      uid: 'user',
      candidates: [{ uid: 'user', role: 'textbox', name: 'Username' }],
    })
  })

  it('fails closed when two exact names share the winning score', () => {
    expect(bindTarget(shop, { name: 'Add to cart' })).toEqual({
      status: 'ambiguous',
      uid: undefined,
      candidates: [
        { uid: 'add1', role: 'button', name: 'Add to cart' },
        { uid: 'add2', role: 'button', name: 'Add to cart' },
      ],
    })
  })

  it('fails closed when two substring hits share the winning score', () => {
    expect(bindTarget(shop, { name: 'Sauce Labs' })).toEqual({
      status: 'ambiguous',
      uid: undefined,
      candidates: [
        { uid: 'bp', role: 'link', name: 'Sauce Labs Backpack' },
        { uid: 'bl', role: 'link', name: 'Sauce Labs Bike Light' },
      ],
    })
  })

  it('still binds an exact name when a longer substring also matches', () => {
    expect(bindTarget(loginPage, { name: 'Login' })).toEqual({
      status: 'bound',
      uid: 'go',
      candidates: [{ uid: 'go', role: 'button', name: ' Login' }],
    })
  })

  it('lists the name trap and allowed controls when nothing is unique', () => {
    const result = bindTarget(loginPage, { name: 'Username', action: 'click' })
    expect(result.status).toBe('none')
    expect(result.uid).toBeUndefined()
    expect(result.candidates).toEqual([
      { uid: 'user', role: 'textbox', name: 'Username' },
      { uid: 'go', role: 'button', name: ' Login' },
    ])
  })

  it('treats a missing near landmark as none', () => {
    expect(bindTarget(shop, { name: 'Add to cart', near: 'Fleece' })).toEqual({
      status: 'none',
      uid: undefined,
      candidates: [],
    })
  })

  it('refuses a near query that hits two landmarks at the same score', () => {
    expect(bindTarget(shop, { name: 'Add to cart', near: 'Sauce Labs' })).toEqual({
      status: 'ambiguous',
      uid: undefined,
      candidates: [
        { uid: 'bp', role: 'link', name: 'Sauce Labs Backpack' },
        { uid: 'bl', role: 'link', name: 'Sauce Labs Bike Light' },
      ],
    })
  })

  it('uses near to take the closest winner, not every later match', () => {
    expect(bindTarget(shop, { name: 'Add to cart', near: 'Backpack' })).toEqual({
      status: 'bound',
      uid: 'add1',
      candidates: [{ uid: 'add1', role: 'button', name: 'Add to cart' }],
    })
  })

  it('clicks Search on an icon button after Search Product', () => {
    const items: OutlineItem[] = [
      { uid: 'box', role: 'textbox', name: 'Search Product', value: 'Blue Top' },
      { uid: 'go', role: 'button', name: 'Search Product' },
      { uid: 'cart', role: 'link', name: ' Cart' },
    ]
    expect(bindTarget(items, { action: 'click', name: 'Search' })).toEqual({
      status: 'bound',
      uid: 'go',
      candidates: [{ uid: 'go', role: 'button', name: 'Search Product' }],
    })
    expect(resolveTarget(items, { action: 'type', name: 'Search Product' })).toBe('box')
  })

  it('uses a product title as a near landmark, including context and value', () => {
    const items: OutlineItem[] = [
      { uid: 'box', role: 'textbox', name: 'Search Product', value: 'Blue Top' },
      { uid: 'go', role: 'button', name: 'Search Product' },
      { uid: 'title', role: 'paragraph', name: 'Blue Top' },
      { uid: 'add1', role: 'link', name: ' Add to cart', context: 'Blue Top' },
      { uid: 'add2', role: 'link', name: ' Add to cart', context: 'Blue Top' },
      { uid: 'view', role: 'link', name: ' View Product', context: 'Blue Top' },
      { uid: 'other', role: 'paragraph', name: 'Men Tshirt' },
      { uid: 'add3', role: 'link', name: ' Add to cart', context: 'Men Tshirt' },
    ]
    expect(bindTarget(items, { action: 'click', name: 'View Product', near: 'Blue Top' })).toEqual({
      status: 'bound',
      uid: 'view',
      candidates: [{ uid: 'view', role: 'link', name: ' View Product', context: 'Blue Top' }],
    })
    expect(bindTarget(items, { action: 'click', name: 'Add to cart', near: 'Blue Top' })).toEqual({
      status: 'bound',
      uid: 'add1',
      candidates: [{ uid: 'add1', role: 'link', name: ' Add to cart', context: 'Blue Top' }],
    })
    expect(bindTarget(items, { action: 'click', name: 'Add to cart', near: 'Men Tshirt' })).toEqual(
      {
        status: 'bound',
        uid: 'add3',
        candidates: [{ uid: 'add3', role: 'link', name: ' Add to cart', context: 'Men Tshirt' }],
      },
    )
  })

  it('prefers a search-box value over a later context hit', () => {
    const items: OutlineItem[] = [
      { uid: 'box', role: 'textbox', name: 'Search Product', value: 'Blue Top' },
      { uid: 'view', role: 'link', name: 'View Product' },
      { uid: 'add', role: 'link', name: 'Add to cart', context: 'Blue Top' },
      { uid: 'view2', role: 'link', name: 'View Product' },
    ]
    expect(resolveTarget(items, { action: 'click', name: 'View Product', near: 'Blue Top' })).toBe(
      'view',
    )
  })

  it('starts after a single empty-name context landmark', () => {
    const items: OutlineItem[] = [
      { uid: 'go', role: 'button', name: '', context: 'Blue Top' },
      { uid: 'view', role: 'link', name: 'View Product' },
    ]
    expect(resolveTarget(items, { action: 'click', name: 'View Product', near: 'Blue Top' })).toBe(
      'view',
    )
  })

  it('uses a search-box value as the near landmark when the title is missing', () => {
    const items: OutlineItem[] = [
      { uid: 'box', role: 'textbox', name: 'Search Product', value: 'Blue Top' },
      { uid: 'view', role: 'link', name: 'View Product' },
    ]
    expect(resolveTarget(items, { action: 'click', name: 'View Product', near: 'Blue Top' })).toBe(
      'view',
    )
  })

  it('prefers a title name over a search-box value for near', () => {
    const items: OutlineItem[] = [
      { uid: 'box', role: 'textbox', name: 'Search Product', value: 'Blue Top' },
      { uid: 'wrong', role: 'link', name: 'View Product', context: 'Wrong Shirt' },
      { uid: 'title', role: 'paragraph', name: 'Blue Top' },
      { uid: 'view', role: 'link', name: 'View Product', context: 'Blue Top' },
    ]
    expect(resolveTarget(items, { action: 'click', name: 'View Product', near: 'Blue Top' })).toBe(
      'view',
    )
  })

  it('does not treat empty icon names as the same landmark', () => {
    const items: OutlineItem[] = [
      { uid: 'a', role: 'button', name: '', context: 'Blue Top' },
      { uid: 'b', role: 'button', name: '', context: 'Blue Top' },
      { uid: 'view', role: 'link', name: 'View Product' },
    ]
    expect(bindTarget(items, { action: 'click', name: 'View Product', near: 'Blue Top' })).toEqual({
      status: 'ambiguous',
      uid: undefined,
      candidates: [
        { uid: 'a', role: 'button', name: '', context: 'Blue Top' },
        { uid: 'b', role: 'button', name: '', context: 'Blue Top' },
      ],
    })
  })

  it('does not collapse two Add to cart buttons that have no context', () => {
    const items: OutlineItem[] = [
      { uid: 'add1', role: 'button', name: 'Add to cart' },
      { uid: 'add2', role: 'button', name: 'Add to cart' },
    ]
    expect(bindTarget(items, { action: 'click', name: 'Add to cart' }).status).toBe('ambiguous')
  })

  it('collapses overlay clones that share a name and context', () => {
    const items: OutlineItem[] = [
      { uid: 'title', role: 'paragraph', name: 'Blue Top' },
      { uid: 'add1', role: 'link', name: ' Add to cart', context: 'Blue Top' },
      { uid: 'add2', role: 'link', name: ' Add to cart', context: 'Blue Top' },
    ]
    expect(bindTarget(items, { action: 'click', name: 'Add to cart' })).toEqual({
      status: 'bound',
      uid: 'add1',
      candidates: [{ uid: 'add1', role: 'link', name: ' Add to cart', context: 'Blue Top' }],
    })
  })

  it('still refuses Add to cart across two different products', () => {
    const items: OutlineItem[] = [
      { uid: 'bp', role: 'link', name: 'Sauce Labs Backpack' },
      { uid: 'add1', role: 'button', name: 'Add to cart', context: 'Sauce Labs Backpack' },
      { uid: 'bl', role: 'link', name: 'Sauce Labs Bike Light' },
      { uid: 'add2', role: 'button', name: 'Add to cart', context: 'Sauce Labs Bike Light' },
    ]
    expect(bindTarget(items, { action: 'click', name: 'Add to cart' }).status).toBe('ambiguous')
  })

  it('collapses duplicate same-name landmarks from a hover overlay', () => {
    const items: OutlineItem[] = [
      { uid: 't1', role: 'paragraph', name: 'Blue Top' },
      { uid: 'view', role: 'link', name: 'View Product', context: 'Blue Top' },
      { uid: 't2', role: 'paragraph', name: 'Blue Top' },
      { uid: 'add2', role: 'link', name: 'Add to cart', context: 'Blue Top' },
    ]
    expect(bindTarget(items, { action: 'click', name: 'View Product', near: 'Blue Top' })).toEqual({
      status: 'bound',
      uid: 'view',
      candidates: [{ uid: 'view', role: 'link', name: 'View Product', context: 'Blue Top' }],
    })
  })

  it('prefers an exact near landmark over a substring one', () => {
    const items: OutlineItem[] = [
      { uid: 'hint', role: 'heading', name: 'Cart help' },
      { uid: 'mark', role: 'heading', name: 'Cart' },
      { uid: 'add', role: 'button', name: 'Add to cart' },
    ]
    expect(bindTarget(items, { name: 'Add to cart', near: 'Cart' })).toEqual({
      status: 'bound',
      uid: 'add',
      candidates: [{ uid: 'add', role: 'button', name: 'Add to cart' }],
    })
  })
})

describe('formatBindFailure', () => {
  it('names the action, query, and candidates for a miss and a tie', () => {
    expect(
      formatBindFailure(
        { action: 'click', name: 'Checkout' },
        { status: 'none', uid: undefined, candidates: [] },
      ),
    ).toBe('no target for click name=Checkout candidates=')
    expect(
      formatBindFailure(
        { action: 'click', name: 'Add to cart', near: 'Backpack' },
        {
          status: 'ambiguous',
          uid: undefined,
          candidates: [
            { uid: 'add1', role: 'button', name: 'Add to cart' },
            { uid: 'add2', role: 'button', name: 'Add to cart' },
          ],
        },
      ),
    ).toBe(
      'ambiguous target for click name=Add to cart near=Backpack candidates=button:Add to cart;button:Add to cart',
    )
  })

  it('caps the printed candidate list', () => {
    const candidates: OutlineItem[] = []
    for (let i = 0; i < BIND_CANDIDATE_LIMIT + 1; i += 1) {
      candidates.push({ uid: `n${String(i)}`, role: 'button', name: `N${String(i)}` })
    }
    const last = candidates[BIND_CANDIDATE_LIMIT]
    expect(last).toBeDefined()
    const printed = formatBindFailure(
      { action: 'click', name: 'Go' },
      { status: 'none', uid: undefined, candidates },
    )
    expect(printed).toContain('button:N0')
    expect(printed).not.toContain(`button:${last?.name ?? ''}`)
    expect(printed.split(';')).toHaveLength(BIND_CANDIDATE_LIMIT)
  })

  it('labels a near-only miss when the name is empty', () => {
    expect(
      formatBindFailure(
        { action: 'click', near: 'Cart' },
        { status: 'none', uid: undefined, candidates: [] },
      ),
    ).toBe('no target for click near=Cart candidates=')
    expect(
      formatBindFailure(
        { name: '', near: 'Cart' },
        { status: 'none', uid: undefined, candidates: [] },
      ),
    ).toBe('no target for target near=Cart candidates=')
    expect(
      formatBindFailure({ near: 'Cart' }, { status: 'ambiguous', uid: undefined, candidates: [] }),
    ).toBe('ambiguous target for target near=Cart candidates=')
    expect(formatBindFailure({}, { status: 'none', uid: undefined, candidates: [] })).toBe(
      'no target for target name= candidates=',
    )
  })
})
