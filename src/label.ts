/** Font-awesome and other PUA icon glyphs that leak into accessible names. */
const ICON_GLYPH = /[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/gu

/** Zero-width and soft-hyphen junk that should not affect matching. */
const INVISIBLE = /[\u200B-\u200D\uFEFF\u00AD]/g

/** Price-only labels (not product titles). */
const PRICE = /^(rs\.?|usd|eur|gbp|\$|€|£)?\s*\d[\d,]*(\.\d+)?$/

/**
 * Fold a visible or accessible label for matching.
 * Strips icon glyphs, hides invisibles, collapses space, lowercases.
 */
export function foldLabel(raw: string): string {
  const stripped = raw.replace(ICON_GLYPH, ' ').replace(INVISIBLE, '')
  return stripped.replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Exact fold beats substring fold. Empty query never matches. */
export function labelScore(itemLabel: string, query: string): number {
  const item = foldLabel(itemLabel)
  const want = foldLabel(query)
  if (want === '') {
    return 0
  }
  if (item === want) {
    return 2
  }
  if (item.includes(want)) {
    return 1
  }
  return 0
}

/** True when the folded label is only a price. */
export function isPriceLabel(raw: string): boolean {
  return PRICE.test(foldLabel(raw))
}

/** True when the label can serve as a product or section landmark. */
export function isTitleLike(raw: string): boolean {
  const folded = foldLabel(raw)
  if (folded.length < 2) {
    return false
  }
  if (isPriceLabel(raw)) {
    return false
  }
  return /[a-z]/.test(folded)
}

/**
 * True when every label folds to the same non-empty string.
 * An empty list, or any empty fold, is not a match.
 */
export function allSameNonEmptyFold(labels: readonly string[]): boolean {
  let want: string | undefined
  for (const label of labels) {
    const folded = foldLabel(label)
    if (folded === '') {
      return false
    }
    if (want === undefined) {
      want = folded
      continue
    }
    if (folded !== want) {
      return false
    }
  }
  return want !== undefined
}
