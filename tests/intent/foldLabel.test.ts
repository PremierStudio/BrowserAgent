import { describe, expect, it } from 'vitest'
import {
  allSameNonEmptyFold,
  foldLabel,
  isPriceLabel,
  isTitleLike,
  labelScore,
} from '../../src/label.js'

describe('foldLabel', () => {
  it('lowercases and trims ordinary labels', () => {
    expect(foldLabel('Features Items')).toBe('features items')
    expect(foldLabel('FEATURES ITEMS')).toBe('features items')
    expect(foldLabel('  Login  ')).toBe('login')
  })

  it('strips private-use icon glyphs and leftover space', () => {
    expect(foldLabel('')).toBe('')
    expect(foldLabel(' Products')).toBe('products')
    expect(foldLabel(' View Product')).toBe('view product')
    expect(foldLabel(' Add to cart')).toBe('add to cart')
    expect(foldLabel(' Cart')).toBe('cart')
    expect(foldLabel('Products')).toBe('pro ducts')
    expect(foldLabel(`\u{F0000}Hidden`)).toBe('hidden')
    expect(foldLabel(`\u{100000}Mark`)).toBe('mark')
  })

  it('strips zero-width junk and collapses inner whitespace', () => {
    expect(foldLabel('Blue\u200B \u00AD Top')).toBe('blue top')
    expect(foldLabel('Blue   Top')).toBe('blue top')
    expect(foldLabel('Blue\uFEFFTop')).toBe('bluetop')
  })
})

describe('labelScore', () => {
  it('scores exact folds above substring folds', () => {
    expect(labelScore('FEATURES ITEMS', 'Features Items')).toBe(2)
    expect(labelScore(' View Product', 'View Product')).toBe(2)
    expect(labelScore('Sauce Labs Backpack', 'Backpack')).toBe(1)
    expect(labelScore('Username', '')).toBe(0)
    expect(labelScore('Login', 'Password')).toBe(0)
    expect(labelScore('', 'Search')).toBe(0)
  })
})

describe('isPriceLabel', () => {
  it('detects bare and currency prices', () => {
    expect(isPriceLabel('Rs. 500')).toBe(true)
    expect(isPriceLabel('RS. 500')).toBe(true)
    expect(isPriceLabel('rs 500')).toBe(true)
    expect(isPriceLabel('usd 12')).toBe(true)
    expect(isPriceLabel('eur 12')).toBe(true)
    expect(isPriceLabel('gbp 12')).toBe(true)
    expect(isPriceLabel('$19.99')).toBe(true)
    expect(isPriceLabel('€12')).toBe(true)
    expect(isPriceLabel('£3')).toBe(true)
    expect(isPriceLabel('1,299')).toBe(true)
    expect(isPriceLabel('499')).toBe(true)
    expect(isPriceLabel('Blue Top')).toBe(false)
    expect(isPriceLabel('Add to cart')).toBe(false)
    expect(isPriceLabel('rs')).toBe(false)
  })
})

describe('isTitleLike', () => {
  it('keeps product titles and drops prices, glyphs, and short junk', () => {
    expect(isTitleLike('Blue Top')).toBe(true)
    expect(isTitleLike('FEATURES ITEMS')).toBe(true)
    expect(isTitleLike('Sauce Labs Backpack')).toBe(true)
    expect(isTitleLike('Rs. 500')).toBe(false)
    expect(isTitleLike('')).toBe(false)
    expect(isTitleLike('')).toBe(false)
    expect(isTitleLike('On')).toBe(true)
    expect(isTitleLike('A')).toBe(false)
  })
})

describe('allSameNonEmptyFold', () => {
  it('requires a non-empty shared fold and rejects empties or splits', () => {
    expect(allSameNonEmptyFold([])).toBe(false)
    expect(allSameNonEmptyFold([''])).toBe(false)
    expect(allSameNonEmptyFold(['Blue Top', ''])).toBe(false)
    expect(allSameNonEmptyFold(['Blue Top', 'Men Tshirt'])).toBe(false)
    expect(allSameNonEmptyFold(['Blue Top'])).toBe(true)
    expect(allSameNonEmptyFold(['BLUE TOP', 'blue top'])).toBe(true)
    expect(allSameNonEmptyFold([' Add to cart', 'Add to cart'])).toBe(true)
  })
})
