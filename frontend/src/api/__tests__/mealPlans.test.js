import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listMealPlans,
  getMealPlan,
  addEntry,
  removeEntry,
  suggestMealPlan,
  getMealPlanStats,
  getMealPlanPrepGuide,
} from '../mealPlans'

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

describe('listMealPlans', () => {
  it('sends GET to /meal-plans/', async () => {
    api.get.mockResolvedValue({ data: [] })

    const result = await listMealPlans()

    expect(api.get).toHaveBeenCalledWith('/meal-plans/')
    expect(result.data).toEqual([])
  })

  it('returns meal plans from the response', async () => {
    const plans = [{ week_start: '2026-03-23' }]
    api.get.mockResolvedValue({ data: plans })

    const result = await listMealPlans()

    expect(result.data).toEqual(plans)
  })
})

describe('getMealPlan', () => {
  it('sends GET to /meal-plans/:weekStart/', async () => {
    api.get.mockResolvedValue({ data: { week_start: '2026-03-23', entries: [] } })

    const result = await getMealPlan('2026-03-23')

    expect(api.get).toHaveBeenCalledWith('/meal-plans/2026-03-23/')
    expect(result.data.week_start).toBe('2026-03-23')
  })
})

describe('addEntry', () => {
  it('sends POST to /meal-plans/:weekStart/entries/ with entry data', async () => {
    const entryData = { day: 0, meal_type: 'lunch', recipe: 5 }
    api.post.mockResolvedValue({ data: { id: 1, ...entryData } })

    const result = await addEntry('2026-03-23', entryData)

    expect(api.post).toHaveBeenCalledWith('/meal-plans/2026-03-23/entries/', entryData)
    expect(result.data.id).toBe(1)
  })
})

describe('removeEntry', () => {
  it('sends DELETE to /meal-plans/:weekStart/entries/:entryId/', async () => {
    api.delete.mockResolvedValue({ status: 204 })

    await removeEntry('2026-03-23', 42)

    expect(api.delete).toHaveBeenCalledWith('/meal-plans/2026-03-23/entries/42/')
  })

  it('propagates errors', async () => {
    api.delete.mockRejectedValue(new Error('Not found'))

    await expect(removeEntry('2026-03-23', 999)).rejects.toThrow('Not found')
  })
})

describe('suggestMealPlan', () => {
  it('sends POST to /meal-plans/suggest/ with defaults', async () => {
    api.post.mockResolvedValue({ data: { entries: [] } })

    await suggestMealPlan()

    expect(api.post).toHaveBeenCalledWith('/meal-plans/suggest/', {
      preferences: '',
      days: 7,
      ai_instructions: '',
    })
  })

  it('merges providerConfig into the request body', async () => {
    api.post.mockResolvedValue({ data: {} })

    await suggestMealPlan({ provider: 'openai' }, 'vegetarian', 5)

    expect(api.post).toHaveBeenCalledWith('/meal-plans/suggest/', {
      provider: 'openai',
      preferences: 'vegetarian',
      days: 5,
      ai_instructions: '',
    })
  })

  it('passes custom preferences and days', async () => {
    api.post.mockResolvedValue({ data: {} })

    await suggestMealPlan({}, 'low-carb', 3)

    expect(api.post).toHaveBeenCalledWith('/meal-plans/suggest/', {
      preferences: 'low-carb',
      days: 3,
      ai_instructions: '',
    })
  })
})

describe('getMealPlanStats', () => {
  it('sends GET to /meal-plans/:weekStart/stats/', async () => {
    const stats = { total_calories: 14000, avg_protein: 80 }
    api.get.mockResolvedValue({ data: stats })

    const result = await getMealPlanStats('2026-03-23')

    expect(api.get).toHaveBeenCalledWith('/meal-plans/2026-03-23/stats/')
    expect(result.data).toEqual(stats)
  })
})

describe('getMealPlanPrepGuide', () => {
  it('sends POST to /meal-plans/:weekStart/prep-guide/ with providerConfig', async () => {
    api.post.mockResolvedValue({ data: { guide: 'Step 1...' } })

    await getMealPlanPrepGuide('2026-03-23', { provider: 'ollama' })

    expect(api.post).toHaveBeenCalledWith('/meal-plans/2026-03-23/prep-guide/', {
      provider: 'ollama',
    })
  })

  it('sends empty object when no providerConfig given', async () => {
    api.post.mockResolvedValue({ data: {} })

    await getMealPlanPrepGuide('2026-03-23')

    expect(api.post).toHaveBeenCalledWith('/meal-plans/2026-03-23/prep-guide/', {})
  })

  it('returns the prep guide data', async () => {
    const guide = { guide: 'Prep on Sunday: chop veggies...' }
    api.post.mockResolvedValue({ data: guide })

    const result = await getMealPlanPrepGuide('2026-03-23')

    expect(result.data).toEqual(guide)
  })
})
