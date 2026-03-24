/**
 * Scale a quantity from base servings to target servings.
 * Returns a number rounded to 2 decimal places, or the original
 * value if it cannot be parsed as a number.
 */
export function scaleQuantity(qty, baseServings, targetServings) {
  const num = parseFloat(qty)
  if (isNaN(num)) return qty
  if (!baseServings || baseServings === 0) return qty
  const scaled = (num * targetServings) / baseServings
  return Math.round(scaled * 100) / 100
}

// Units that indicate a number is an ingredient quantity worth scaling.
const UNIT_PATTERN =
  'kg|g|ml|l|oz|lb|lbs|cup|cups|tbsp|tsp|tablespoons?|teaspoons?|pieces?|cloves?|pinch|pinches|bunch|bunches|slices?|strips?'

const QTY_RE = new RegExp(
  `(\\d+(?:[./]\\d+)?)\\s*(${UNIT_PATTERN})\\b`,
  'gi',
)

function formatScaled(num) {
  // Show fractions nicely for small numbers
  const rounded = Math.round(num * 100) / 100
  return rounded % 1 === 0 ? String(rounded) : String(rounded)
}

/**
 * Parse an instruction string and return an array of segments.
 * Each segment is either { text: string, scaled: false }
 * or { original: string, scaledText: string, scaled: true }.
 * When baseServings === targetServings, no segment will have scaled: true.
 */
export function parseInstructionSegments(text, baseServings, targetServings) {
  if (!text) return []
  if (!baseServings || baseServings === targetServings) {
    return [{ text, scaled: false }]
  }

  const ratio = targetServings / baseServings
  const segments = []
  let lastIndex = 0
  let match

  QTY_RE.lastIndex = 0
  while ((match = QTY_RE.exec(text)) !== null) {
    const [full, numStr, unit] = match

    // Handle fractions like "1/2"
    let num
    if (numStr.includes('/')) {
      const [n, d] = numStr.split('/')
      num = parseFloat(n) / parseFloat(d)
    } else {
      num = parseFloat(numStr)
    }

    if (isNaN(num)) continue

    // Push text before this match
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), scaled: false })
    }

    const scaledNum = Math.round(num * ratio * 100) / 100
    segments.push({
      original: full,
      scaledText: `${formatScaled(scaledNum)} ${unit}`,
      scaled: true,
    })

    lastIndex = match.index + full.length
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), scaled: false })
  }

  return segments
}
