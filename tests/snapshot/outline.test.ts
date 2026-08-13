import { describe, expect, it } from 'vitest'
import {
  asSnapshotNode,
  outlineFromUnknown,
  OUTLINE_ROLES,
  outlineFromSnapshot,
} from '../../src/snapshot/outline.js'
import type { SnapshotNode } from '../../src/snapshot/a11ySnapshot.js'

describe('asSnapshotNode', () => {
  it('rejects number and boolean primitives without throwing', () => {
    expect(asSnapshotNode(0)).toBeUndefined()
    expect(asSnapshotNode(1)).toBeUndefined()
    expect(asSnapshotNode(false)).toBeUndefined()
    expect(asSnapshotNode(true)).toBeUndefined()
    expect(asSnapshotNode(undefined)).toBeUndefined()
  })

  it('rejects values that are not snapshot nodes', () => {
    expect(asSnapshotNode(null)).toBeUndefined()
    expect(asSnapshotNode('x')).toBeUndefined()
    expect(asSnapshotNode(1)).toBeUndefined()
    expect(asSnapshotNode(true)).toBeUndefined()
    expect(asSnapshotNode({ uid: 1, role: 'button', name: 'Go' })).toBeUndefined()
    expect(asSnapshotNode({ uid: 'a', role: 1, name: 'Go' })).toBeUndefined()
    expect(asSnapshotNode({ uid: 'a', role: 'button', name: 2 })).toBeUndefined()
    expect(asSnapshotNode({ uid: 'a', role: 'button' })).toBeUndefined()
  })

  it('omits children when none parse', () => {
    expect(
      asSnapshotNode({
        uid: 'a',
        role: 'button',
        name: 'Go',
        children: [null, { uid: 1 }],
      }),
    ).toEqual({ uid: 'a', role: 'button', name: 'Go' })
  })

  it('omits a non-string value field', () => {
    expect(
      asSnapshotNode({
        uid: 'a',
        role: 'button',
        name: 'Go',
        value: 1,
      }),
    ).toEqual({ uid: 'a', role: 'button', name: 'Go' })
  })

  it('keeps string values and skips invalid children', () => {
    expect(
      asSnapshotNode({
        uid: 'a',
        role: 'textbox',
        name: 'Name',
        value: 'Alex',
        children: [{ nope: true }, { uid: 'b', role: 'button', name: 'Go' }],
      }),
    ).toEqual({
      uid: 'a',
      role: 'textbox',
      name: 'Name',
      value: 'Alex',
      children: [{ uid: 'b', role: 'button', name: 'Go' }],
    })
  })
})

describe('outlineFromUnknown', () => {
  it('returns an empty list when the value is not a snapshot', () => {
    expect(outlineFromUnknown(null)).toEqual([])
    expect(outlineFromUnknown('nope')).toEqual([])
  })

  it('outlines a valid snapshot tree', () => {
    expect(outlineFromUnknown({ uid: 'a', role: 'button', name: 'Go' })).toEqual([
      { uid: 'a', role: 'button', name: 'Go' },
    ])
  })
})

describe('outlineFromSnapshot', () => {
  it('keeps headings and interactive controls, drops decorative nodes', () => {
    const tree: SnapshotNode = {
      uid: 'root',
      role: 'RootWebArea',
      name: 'Home',
      children: [
        { uid: 'h', role: 'heading', name: 'Hero' },
        {
          uid: 'p',
          role: 'paragraph',
          name: '',
          children: [{ uid: 't', role: 'StaticText', name: '…' }],
        },
        { uid: 'a', role: 'link', name: 'About' },
        { uid: 'name', role: 'textbox', name: 'Name', value: '' },
        { uid: 'go', role: 'button', name: 'Submit' },
        { uid: 'err', role: 'alert', name: 'Please add your name.' },
      ],
    }
    expect(outlineFromSnapshot(tree)).toEqual([
      { uid: 'h', role: 'heading', name: 'Hero' },
      { uid: 'a', role: 'link', name: 'About', context: 'Hero' },
      { uid: 'name', role: 'textbox', name: 'Name', value: '', context: 'Hero' },
      { uid: 'go', role: 'button', name: 'Submit', context: 'Hero' },
      { uid: 'err', role: 'alert', name: 'Please add your name.' },
    ])
  })

  it('does not treat the page root as a product landmark', () => {
    expect(
      outlineFromSnapshot({
        uid: 'doc',
        role: 'document',
        name: 'Home',
        children: [{ uid: 'go', role: 'button', name: 'Go' }],
      }),
    ).toEqual([{ uid: 'go', role: 'button', name: 'Go' }])
    expect(
      outlineFromSnapshot({
        uid: 'web',
        role: 'WebArea',
        name: 'Shop',
        children: [{ uid: 'go', role: 'button', name: 'Go' }],
      }),
    ).toEqual([{ uid: 'go', role: 'button', name: 'Go' }])
    expect(
      outlineFromSnapshot({
        uid: 'frame',
        role: 'Iframe',
        name: 'Ad',
        children: [{ uid: 'go', role: 'button', name: 'Go' }],
      }),
    ).toEqual([{ uid: 'go', role: 'button', name: 'Go' }])
  })

  it('pins every role that belongs in an outline', () => {
    expect([...OUTLINE_ROLES].sort()).toEqual(
      [
        'alert',
        'button',
        'checkbox',
        'combobox',
        'heading',
        'link',
        'menuitem',
        'radio',
        'searchbox',
        'slider',
        'spinbutton',
        'switch',
        'tab',
        'textbox',
      ].sort(),
    )
  })

  it('applies a later sibling title to a control that appears first', () => {
    const tree: SnapshotNode = {
      uid: 'root',
      role: 'generic',
      name: '',
      children: [
        { uid: 'empty', role: 'generic', name: '' },
        { uid: 'add', role: 'button', name: 'Add to cart' },
        { uid: 'g', role: 'generic', name: 'Winter Jacket' },
      ],
    }
    expect(outlineFromSnapshot(tree)).toEqual([
      { uid: 'add', role: 'button', name: 'Add to cart', context: 'Winter Jacket' },
      { uid: 'g', role: 'generic', name: 'Winter Jacket' },
    ])
  })

  it('skips an empty first sibling when picking a group title', () => {
    const tree: SnapshotNode = {
      uid: 'root',
      role: 'generic',
      name: '',
      children: [
        { uid: 'empty', role: 'generic', name: '' },
        { uid: 'g', role: 'generic', name: 'Winter Jacket' },
        { uid: 'view', role: 'link', name: 'View Product' },
      ],
    }
    expect(outlineFromSnapshot(tree)).toEqual([
      { uid: 'g', role: 'generic', name: 'Winter Jacket' },
      { uid: 'view', role: 'link', name: 'View Product', context: 'Winter Jacket' },
    ])
  })

  it('finds a title under a later sibling when the first child has no text', () => {
    const tree: SnapshotNode = {
      uid: 'root',
      role: 'generic',
      name: '',
      children: [
        {
          uid: 'wrap',
          role: 'generic',
          name: '',
          children: [
            { uid: 'empty', role: 'generic', name: '' },
            { uid: 'g', role: 'generic', name: 'Winter Jacket' },
          ],
        },
        { uid: 'view', role: 'link', name: 'View Product' },
      ],
    }
    expect(outlineFromSnapshot(tree)).toEqual([
      { uid: 'g', role: 'generic', name: 'Winter Jacket' },
      { uid: 'view', role: 'link', name: 'View Product', context: 'Winter Jacket' },
    ])
  })

  it('uses any non-clickable title as a landmark, including generic and cell', () => {
    const tree: SnapshotNode = {
      uid: 'root',
      role: 'generic',
      name: '',
      children: [
        { uid: 'g', role: 'generic', name: 'Winter Jacket' },
        { uid: 'view', role: 'link', name: 'View Product' },
        { uid: 'cell', role: 'cell', name: 'Canvas Tote' },
        { uid: 'add', role: 'button', name: 'Add to cart' },
      ],
    }
    expect(outlineFromSnapshot(tree)).toEqual([
      { uid: 'g', role: 'generic', name: 'Winter Jacket' },
      { uid: 'view', role: 'link', name: 'View Product', context: 'Winter Jacket' },
      { uid: 'cell', role: 'cell', name: 'Canvas Tote' },
      { uid: 'add', role: 'button', name: 'Add to cart', context: 'Canvas Tote' },
    ])
  })

  it('keeps a nested card title from leaking onto the next card', () => {
    const tree: SnapshotNode = {
      uid: 'root',
      role: 'generic',
      name: '',
      children: [
        { uid: 'feat', role: 'heading', name: 'FEATURES ITEMS' },
        {
          uid: 'card1',
          role: 'generic',
          name: '',
          children: [
            { uid: 't1', role: 'generic', name: 'Blue Top' },
            { uid: 'add1', role: 'button', name: 'Add to cart' },
          ],
        },
        {
          uid: 'card2',
          role: 'generic',
          name: '',
          children: [{ uid: 'add2', role: 'button', name: 'Add to cart' }],
        },
      ],
    }
    expect(outlineFromSnapshot(tree)).toEqual([
      { uid: 'feat', role: 'heading', name: 'FEATURES ITEMS' },
      { uid: 't1', role: 'generic', name: 'Blue Top' },
      { uid: 'add1', role: 'button', name: 'Add to cart', context: 'Blue Top' },
      { uid: 'add2', role: 'button', name: 'Add to cart', context: 'FEATURES ITEMS' },
    ])
  })

  it('emits the first product paragraph even when it is not an outline role', () => {
    const tree: SnapshotNode = {
      uid: 'root',
      role: 'generic',
      name: '',
      children: [{ uid: 'title', role: 'paragraph', name: 'Blue Top' }],
    }
    expect(outlineFromSnapshot(tree)).toEqual([
      { uid: 'title', role: 'paragraph', name: 'Blue Top' },
    ])
  })

  it('promotes named paragraphs as landmarks and tags later controls with context', () => {
    const tree: SnapshotNode = {
      uid: 'root',
      role: 'generic',
      name: '',
      children: [
        { uid: 'title', role: 'paragraph', name: 'Blue Top' },
        { uid: 'price', role: 'heading', name: 'Rs. 500' },
        { uid: 'add1', role: 'link', name: ' Add to cart' },
        { uid: 'price2', role: 'heading', name: 'Rs. 500' },
        { uid: 'add2', role: 'link', name: ' Add to cart' },
        { uid: 'view', role: 'link', name: ' View Product' },
        { uid: 'other', role: 'paragraph', name: 'Men Tshirt' },
        { uid: 'add3', role: 'link', name: ' Add to cart' },
      ],
    }
    expect(outlineFromSnapshot(tree)).toEqual([
      { uid: 'title', role: 'paragraph', name: 'Blue Top' },
      { uid: 'price', role: 'heading', name: 'Rs. 500', context: 'Blue Top' },
      { uid: 'add1', role: 'link', name: ' Add to cart', context: 'Blue Top' },
      { uid: 'price2', role: 'heading', name: 'Rs. 500', context: 'Blue Top' },
      { uid: 'add2', role: 'link', name: ' Add to cart', context: 'Blue Top' },
      { uid: 'view', role: 'link', name: ' View Product', context: 'Blue Top' },
      { uid: 'other', role: 'paragraph', name: 'Men Tshirt' },
      { uid: 'add3', role: 'link', name: ' Add to cart', context: 'Men Tshirt' },
    ])
  })

  it('gives an icon-only submit the preceding field name', () => {
    const tree: SnapshotNode = {
      uid: 'root',
      role: 'generic',
      name: '',
      children: [
        { uid: 'box', role: 'textbox', name: 'Search Product', value: 'Blue Top' },
        { uid: 'go', role: 'button', name: '' },
        { uid: 'mail', role: 'textbox', name: 'Your email address' },
        { uid: 'sub', role: 'button', name: '' },
      ],
    }
    expect(outlineFromSnapshot(tree)).toEqual([
      { uid: 'box', role: 'textbox', name: 'Search Product', value: 'Blue Top' },
      { uid: 'go', role: 'button', name: 'Search Product' },
      { uid: 'mail', role: 'textbox', name: 'Your email address' },
      { uid: 'sub', role: 'button', name: 'Your email address' },
    ])
  })

  it('skips StaticText that repeats the parent paragraph name', () => {
    const tree: SnapshotNode = {
      uid: 'root',
      role: 'generic',
      name: '',
      children: [
        {
          uid: 'p',
          role: 'paragraph',
          name: 'Blue Top',
          children: [{ uid: 't', role: 'StaticText', name: 'Blue Top' }],
        },
        { uid: 'view', role: 'link', name: 'View Product' },
      ],
    }
    expect(outlineFromSnapshot(tree)).toEqual([
      { uid: 'p', role: 'paragraph', name: 'Blue Top' },
      { uid: 'view', role: 'link', name: 'View Product', context: 'Blue Top' },
    ])
  })

  it('promotes a named image and a label as landmarks', () => {
    const tree: SnapshotNode = {
      uid: 'root',
      role: 'generic',
      name: '',
      children: [
        { uid: 'img', role: 'image', name: 'Blue Top' },
        { uid: 'lab', role: 'label', name: 'Quantity' },
        { uid: 'qty', role: 'textbox', name: 'Qty' },
        { uid: 'lt', role: 'LabelText', name: 'Size' },
        { uid: 'add', role: 'button', name: 'Add to cart' },
      ],
    }
    expect(outlineFromSnapshot(tree)).toEqual([
      { uid: 'img', role: 'image', name: 'Blue Top' },
      { uid: 'lab', role: 'label', name: 'Quantity' },
      { uid: 'qty', role: 'textbox', name: 'Qty', context: 'Quantity' },
      { uid: 'lt', role: 'LabelText', name: 'Size' },
      { uid: 'add', role: 'button', name: 'Add to cart', context: 'Size' },
    ])
  })

  it('does not inherit an icon name from a heading', () => {
    const tree: SnapshotNode = {
      uid: 'root',
      role: 'generic',
      name: '',
      children: [
        { uid: 'h', role: 'heading', name: 'FEATURES ITEMS' },
        { uid: 'go', role: 'button', name: '' },
      ],
    }
    const items = outlineFromSnapshot(tree)
    expect(items).toEqual([
      { uid: 'h', role: 'heading', name: 'FEATURES ITEMS' },
      { uid: 'go', role: 'button', name: '', context: 'FEATURES ITEMS' },
    ])
    expect(items[0]).not.toHaveProperty('value')
  })

  it('does not copy a title onto a control with the same name', () => {
    const tree: SnapshotNode = {
      uid: 'root',
      role: 'generic',
      name: '',
      children: [
        { uid: 't', role: 'paragraph', name: 'Blue Top' },
        { uid: 'b', role: 'button', name: 'Blue Top' },
      ],
    }
    expect(outlineFromSnapshot(tree)).toEqual([
      { uid: 't', role: 'paragraph', name: 'Blue Top' },
      { uid: 'b', role: 'button', name: 'Blue Top' },
    ])
  })

  it('keeps a leading icon-only button instead of inheriting undefined', () => {
    expect(outlineFromSnapshot({ uid: 'go', role: 'button', name: '' })).toEqual([
      { uid: 'go', role: 'button', name: '' },
    ])
  })

  it('keeps a named button instead of inheriting the field', () => {
    const tree: SnapshotNode = {
      uid: 'root',
      role: 'generic',
      name: '',
      children: [
        { uid: 'box', role: 'textbox', name: 'Search Product' },
        { uid: 'go', role: 'button', name: 'Search' },
      ],
    }
    expect(outlineFromSnapshot(tree)).toEqual([
      { uid: 'box', role: 'textbox', name: 'Search Product' },
      { uid: 'go', role: 'button', name: 'Search' },
    ])
  })

  it('promotes named StaticText when the parent paragraph has no name', () => {
    const tree: SnapshotNode = {
      uid: 'root',
      role: 'generic',
      name: '',
      children: [
        {
          uid: 'p',
          role: 'paragraph',
          name: '',
          children: [{ uid: 't', role: 'StaticText', name: 'Blue Top' }],
        },
        { uid: 'view', role: 'link', name: 'View Product' },
      ],
    }
    expect(outlineFromSnapshot(tree)).toEqual([
      { uid: 't', role: 'StaticText', name: 'Blue Top' },
      { uid: 'view', role: 'link', name: 'View Product', context: 'Blue Top' },
    ])
  })

  it('keeps an unlabeled combobox name empty when no title came first', () => {
    expect(
      outlineFromSnapshot({ uid: 'sel', role: 'combobox', name: '', value: '---Your Name---' }),
    ).toEqual([{ uid: 'sel', role: 'combobox', name: '', value: '---Your Name---' }])
  })

  it('names an empty number field from Amount to be Deposited', () => {
    const tree: SnapshotNode = {
      uid: 'root',
      role: 'generic',
      name: '',
      children: [
        {
          uid: 'form',
          role: 'form',
          name: '',
          children: [
            { uid: 'lab', role: 'StaticText', name: 'Amount to be Deposited :' },
            { uid: 'amt', role: 'spinbutton', name: '', value: '' },
            { uid: 'go', role: 'button', name: 'Deposit' },
          ],
        },
      ],
    }
    expect(outlineFromSnapshot(tree)).toEqual([
      { uid: 'lab', role: 'StaticText', name: 'Amount to be Deposited :' },
      {
        uid: 'amt',
        role: 'spinbutton',
        name: 'Amount to be Deposited :',
        value: '',
      },
      { uid: 'go', role: 'button', name: 'Deposit', context: 'Amount to be Deposited :' },
    ])
  })

  it('names an empty combobox from the preceding Your Name label', () => {
    const tree: SnapshotNode = {
      uid: 'root',
      role: 'generic',
      name: '',
      children: [
        {
          uid: 'form',
          role: 'form',
          name: '',
          children: [
            {
              uid: 'lab',
              role: 'LabelText',
              name: '',
              children: [{ uid: 't', role: 'StaticText', name: 'Your Name :' }],
            },
            { uid: 'sel', role: 'combobox', name: '', value: '---Your Name---' },
          ],
        },
      ],
    }
    expect(outlineFromSnapshot(tree)).toEqual([
      { uid: 't', role: 'StaticText', name: 'Your Name :' },
      { uid: 'sel', role: 'combobox', name: 'Your Name :', value: '---Your Name---' },
    ])
  })

  it('walks nested children and omits empty values', () => {
    const tree: SnapshotNode = {
      uid: 'root',
      role: 'generic',
      name: '',
      children: [
        {
          uid: 'form',
          role: 'form',
          name: '',
          children: [{ uid: 'box', role: 'searchbox', name: 'Search' }],
        },
      ],
    }
    expect(outlineFromSnapshot(tree)).toEqual([{ uid: 'box', role: 'searchbox', name: 'Search' }])
  })
})
