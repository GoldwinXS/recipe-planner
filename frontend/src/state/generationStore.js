/**
 * Module-level stores for AI generation state.
 *
 * State lives outside React components so it survives route navigation.
 * Components subscribe on mount and unsubscribe on unmount; the underlying
 * promise/generation continues even when the component isn't mounted.
 */

function createStore(initial) {
  let state = { ...initial }
  const listeners = new Set()

  function get() {
    return state
  }

  function set(partial) {
    state = { ...state, ...partial }
    listeners.forEach((fn) => fn(state))
  }

  function reset() {
    state = { ...initial }
    listeners.forEach((fn) => fn(state))
  }

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  return { get, set, reset, subscribe }
}

// ── Recipe generation (ClaudeGenerator page) ─────────────────────────────────

export const recipeGenStore = createStore({
  mode: 'generate',
  // generate mode
  prompt: '',
  generating: false,
  generated: null,
  // url mode
  urlInput: '',
  urlFetching: false,
  urlParsing: false,
  urlRecipe: null,
  urlStructured: null,
  parseText: '',
  urlError: null,
  // paste text mode
  pasteRawText: '',
  textParsing: false,
  textRecipe: null,
  textError: null,
  // paste json mode
  jsonText: '',
  jsonRecipe: null,
  jsonError: null,
  // shared
  saving: false,
  saved: false,
  error: null,
})

// ── Meal plan suggestion (MealPlanner page) ───────────────────────────────────

export const mealPlanSuggestStore = createStore({
  suggesting: false,
  suggestStep: '',
  suggestError: null,
  suggestDone: false,
  preferences: '',
})
