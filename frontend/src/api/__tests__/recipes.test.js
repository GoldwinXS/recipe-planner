import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  generateRecipe,
  saveGeneratedRecipe,
  listTags,
  fetchRecipeUrl,
  getOllamaModels,
  fillRecipeMacros,
  remixRecipe,
} from '../recipes'

vi.mock('../axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import api from '../axios'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listRecipes', () => {
  it('sends GET to /recipes/ with no params by default', async () => {
    api.get.mockResolvedValue({ data: { results: [] } })

    await listRecipes()

    expect(api.get).toHaveBeenCalledWith('/recipes/', { params: {} })
  })

  it('passes query params through', async () => {
    api.get.mockResolvedValue({ data: { results: [] } })

    await listRecipes({ search: 'pasta', page: 2 })

    expect(api.get).toHaveBeenCalledWith('/recipes/', {
      params: { search: 'pasta', page: 2 },
    })
  })

  it('returns the API response', async () => {
    const recipes = [{ id: 1, title: 'Pasta' }]
    api.get.mockResolvedValue({ data: { results: recipes } })

    const result = await listRecipes()

    expect(result.data.results).toEqual(recipes)
  })
})

describe('getRecipe', () => {
  it('sends GET to /recipes/:id/', async () => {
    api.get.mockResolvedValue({ data: { id: 42, title: 'Soup' } })

    const result = await getRecipe(42)

    expect(api.get).toHaveBeenCalledWith('/recipes/42/')
    expect(result.data.id).toBe(42)
  })
})

describe('createRecipe', () => {
  it('sends POST to /recipes/ with recipe data', async () => {
    const recipeData = { title: 'New Recipe', ingredients: [] }
    api.post.mockResolvedValue({ data: { id: 1, ...recipeData } })

    const result = await createRecipe(recipeData)

    expect(api.post).toHaveBeenCalledWith('/recipes/', recipeData)
    expect(result.data.title).toBe('New Recipe')
  })
})

describe('updateRecipe', () => {
  it('sends PUT to /recipes/:id/ with updated data', async () => {
    const data = { title: 'Updated' }
    api.put.mockResolvedValue({ data: { id: 5, title: 'Updated' } })

    const result = await updateRecipe(5, data)

    expect(api.put).toHaveBeenCalledWith('/recipes/5/', data)
    expect(result.data.title).toBe('Updated')
  })
})

describe('deleteRecipe', () => {
  it('sends DELETE to /recipes/:id/', async () => {
    api.delete.mockResolvedValue({ status: 204 })

    await deleteRecipe(10)

    expect(api.delete).toHaveBeenCalledWith('/recipes/10/')
  })
})

describe('generateRecipe', () => {
  it('sends POST to /recipes/generate/ with prompt', async () => {
    api.post.mockResolvedValue({ data: { title: 'AI Recipe' } })

    await generateRecipe('make me a salad')

    expect(api.post).toHaveBeenCalledWith('/recipes/generate/', {
      prompt: 'make me a salad',
    })
  })

  it('merges providerConfig into the request body', async () => {
    api.post.mockResolvedValue({ data: {} })

    await generateRecipe('pasta', { provider: 'openai', model: 'gpt-4' })

    expect(api.post).toHaveBeenCalledWith('/recipes/generate/', {
      prompt: 'pasta',
      provider: 'openai',
      model: 'gpt-4',
    })
  })

  it('defaults providerConfig to empty object', async () => {
    api.post.mockResolvedValue({ data: {} })

    await generateRecipe('soup')

    expect(api.post).toHaveBeenCalledWith('/recipes/generate/', {
      prompt: 'soup',
    })
  })
})

describe('saveGeneratedRecipe', () => {
  it('sends POST to /recipes/save-generated/ with data', async () => {
    const data = { title: 'Saved', ingredients: ['a', 'b'] }
    api.post.mockResolvedValue({ data: { id: 99, ...data } })

    const result = await saveGeneratedRecipe(data)

    expect(api.post).toHaveBeenCalledWith('/recipes/save-generated/', data)
    expect(result.data.id).toBe(99)
  })
})

describe('listTags', () => {
  it('sends GET to /recipes/tags/', async () => {
    const tags = ['italian', 'quick']
    api.get.mockResolvedValue({ data: tags })

    const result = await listTags()

    expect(api.get).toHaveBeenCalledWith('/recipes/tags/')
    expect(result.data).toEqual(tags)
  })
})

describe('fetchRecipeUrl', () => {
  it('sends POST to /recipes/fetch-url/ with url in body', async () => {
    const url = 'https://example.com/recipe'
    api.post.mockResolvedValue({ data: { title: 'Fetched' } })

    await fetchRecipeUrl(url)

    expect(api.post).toHaveBeenCalledWith('/recipes/fetch-url/', { url })
  })
})

describe('getOllamaModels', () => {
  it('sends POST to /ai/ollama-models/ with ollama_url', async () => {
    api.post.mockResolvedValue({ data: { models: ['llama2'] } })

    await getOllamaModels('http://localhost:11434')

    expect(api.post).toHaveBeenCalledWith('/ai/ollama-models/', {
      ollama_url: 'http://localhost:11434',
    })
  })
})

describe('fillRecipeMacros', () => {
  it('sends POST to /recipes/:id/fill-macros/ with providerConfig', async () => {
    api.post.mockResolvedValue({ data: { calories: 500 } })

    await fillRecipeMacros(7, { provider: 'openai' })

    expect(api.post).toHaveBeenCalledWith('/recipes/7/fill-macros/', {
      provider: 'openai',
    })
  })

  it('sends empty object when no providerConfig given', async () => {
    api.post.mockResolvedValue({ data: {} })

    await fillRecipeMacros(7)

    expect(api.post).toHaveBeenCalledWith('/recipes/7/fill-macros/', {})
  })
})

describe('remixRecipe', () => {
  it('sends POST to /recipes/:id/remix/ with instruction and providerConfig', async () => {
    api.post.mockResolvedValue({ data: { title: 'Remixed' } })

    await remixRecipe(3, 'make it vegan', { provider: 'ollama' })

    expect(api.post).toHaveBeenCalledWith('/recipes/3/remix/', {
      instruction: 'make it vegan',
      provider: 'ollama',
    })
  })

  it('defaults providerConfig to empty object', async () => {
    api.post.mockResolvedValue({ data: {} })

    await remixRecipe(3, 'add spice')

    expect(api.post).toHaveBeenCalledWith('/recipes/3/remix/', {
      instruction: 'add spice',
    })
  })

  it('returns the response from the API', async () => {
    const mockData = { id: 4, title: 'Spicy Remix' }
    api.post.mockResolvedValue({ data: mockData })

    const result = await remixRecipe(3, 'add spice')

    expect(result.data).toEqual(mockData)
  })
})
