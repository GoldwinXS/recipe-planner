import { pipeline, env } from '@xenova/transformers'

// Always use remote models (no local model files)
env.allowLocalModels = false

let generator = null

async function getGenerator() {
  if (generator) return generator
  generator = await pipeline('text2text-generation', 'Xenova/flan-t5-base', {
    progress_callback: (p) => self.postMessage({ type: 'progress', progress: p }),
  })
  return generator
}

// ── Extraction helpers ──────────────────────────────────────────────────────
// Rather than asking the model to output a full JSON blob (unreliable for
// small models), we run several focused prompts and assemble the result in JS.

async function ask(gen, prompt) {
  const out = await gen(prompt, { max_new_tokens: 256, do_sample: false })
  return out[0].generated_text.trim()
}

function parseIntOr(text, fallback = 0) {
  const m = text.match(/\d+/)
  return m ? parseInt(m[0], 10) : fallback
}

// Parse "1.5 cups butter, finely chopped" into { name, quantity, unit, notes }
function parseIngredientLine(line) {
  line = line.replace(/^[-•*]\s*/, '').trim()
  // Match leading number (int or decimal or fraction) + optional unit
  const m = line.match(
    /^(\d+(?:[./]\d+)?)\s*(g|kg|ml|l|oz|lb|lbs|cup|cups|tbsp|tsp|tablespoons?|teaspoons?|pieces?|cloves?|pinch|pinches|bunch|bunches|slice|slices|can|cans|package|packages?)?\s*(.+)/i,
  )
  if (!m) return { name: line, quantity: 1, unit: 'piece', notes: '' }

  let qty = m[1].includes('/')
    ? m[1].split('/').reduce((a, b) => parseFloat(a) / parseFloat(b))
    : parseFloat(m[1])

  const unit = m[2] || 'piece'
  const rest = m[3].trim()

  // Split "butter, finely chopped" → name="butter", notes="finely chopped"
  const commaIdx = rest.indexOf(',')
  const name = commaIdx > -1 ? rest.slice(0, commaIdx).trim() : rest
  const notes = commaIdx > -1 ? rest.slice(commaIdx + 1).trim() : ''

  return { name, quantity: qty, unit: unit.toLowerCase(), notes }
}

self.onmessage = async ({ data }) => {
  if (data.type !== 'parse') return

  const text = data.text.slice(0, 3000) // cap input length

  try {
    self.postMessage({ type: 'status', message: 'Loading model…' })
    const gen = await getGenerator()

    self.postMessage({ type: 'status', message: 'Extracting title…' })
    const title = await ask(gen, `What is the name of this recipe?\n\n${text}\n\nRecipe name:`)

    self.postMessage({ type: 'status', message: 'Extracting times & servings…' })
    const servingsRaw = await ask(gen, `How many servings does this recipe make? Answer with a number only.\n\n${text}\n\nServings:`)
    const prepRaw = await ask(gen, `How many minutes of prep time does this recipe need? Answer with a number only.\n\n${text}\n\nPrep minutes:`)
    const cookRaw = await ask(gen, `How many minutes of cook time does this recipe need? Answer with a number only.\n\n${text}\n\nCook minutes:`)

    self.postMessage({ type: 'status', message: 'Extracting description…' })
    const description = await ask(gen, `Write one sentence describing this recipe.\n\n${text}\n\nDescription:`)

    self.postMessage({ type: 'status', message: 'Extracting ingredients…' })
    const ingredientsRaw = await ask(
      gen,
      `List every ingredient in this recipe. Put each one on its own line starting with its quantity and unit.\n\n${text}\n\nIngredients:`,
    )

    self.postMessage({ type: 'status', message: 'Extracting instructions…' })
    const instructionsRaw = await ask(
      gen,
      `List the cooking steps for this recipe. Number each step.\n\n${text}\n\nSteps:`,
    )

    self.postMessage({ type: 'status', message: 'Extracting tags…' })
    const tagsRaw = await ask(
      gen,
      `List 3-5 short tags for this recipe separated by commas (e.g. dinner, vegetarian, quick).\n\n${text}\n\nTags:`,
    )

    // ── Assemble ──────────────────────────────────────────────────────────
    const ingredients = ingredientsRaw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map(parseIngredientLine)

    // Normalise instructions: strip leading numbers/bullets, join with \n
    const steps = instructionsRaw
      .split('\n')
      .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter(Boolean)
      .map((s, i) => `Step ${i + 1}: ${s}`)
      .join('\n')

    const tags = tagsRaw
      .split(/,|;/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)

    const recipe = {
      title: title.replace(/^["']|["']$/g, ''),
      description: description.replace(/^["']|["']$/g, ''),
      servings: parseIntOr(servingsRaw, 4),
      prep_time_minutes: parseIntOr(prepRaw, 0),
      cook_time_minutes: parseIntOr(cookRaw, 0),
      instructions: steps,
      ingredients,
      tags,
    }

    self.postMessage({ type: 'result', recipe })
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message })
  }
}
