import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getShoppingList, toggleItem, clearList } from '../shopping'

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

describe('getShoppingList', () => {
  it('sends GET to /shopping/:weekStart/', async () => {
    api.get.mockResolvedValue({ data: { items: [] } })

    const result = await getShoppingList('2026-03-23')

    expect(api.get).toHaveBeenCalledWith('/shopping/2026-03-23/')
    expect(result.data.items).toEqual([])
  })

  it('returns items from the response', async () => {
    const items = [
      { id: 1, name: 'Tomatoes', checked: false },
      { id: 2, name: 'Onions', checked: true },
    ]
    api.get.mockResolvedValue({ data: { items } })

    const result = await getShoppingList('2026-03-23')

    expect(result.data.items).toHaveLength(2)
    expect(result.data.items[0].name).toBe('Tomatoes')
  })

  it('calls with the correct week start string', async () => {
    api.get.mockResolvedValue({ data: {} })

    await getShoppingList('2025-12-29')

    expect(api.get).toHaveBeenCalledWith('/shopping/2025-12-29/')
  })
})

describe('toggleItem', () => {
  it('sends PATCH to /shopping/:weekStart/items/:id/toggle/', async () => {
    api.patch.mockResolvedValue({ data: { id: 5, checked: true } })

    const result = await toggleItem('2026-03-23', 5)

    expect(api.patch).toHaveBeenCalledWith('/shopping/2026-03-23/items/5/toggle/')
    expect(result.data.checked).toBe(true)
  })

  it('toggles an already-checked item', async () => {
    api.patch.mockResolvedValue({ data: { id: 5, checked: false } })

    const result = await toggleItem('2026-03-23', 5)

    expect(result.data.checked).toBe(false)
  })

  it('propagates errors on failure', async () => {
    api.patch.mockRejectedValue(new Error('Not found'))

    await expect(toggleItem('2026-03-23', 999)).rejects.toThrow('Not found')
  })
})

describe('clearList', () => {
  it('sends DELETE to /shopping/:weekStart/', async () => {
    api.delete.mockResolvedValue({ status: 204 })

    await clearList('2026-03-23')

    expect(api.delete).toHaveBeenCalledWith('/shopping/2026-03-23/')
  })

  it('uses the correct weekStart in the URL', async () => {
    api.delete.mockResolvedValue({ status: 204 })

    await clearList('2025-01-06')

    expect(api.delete).toHaveBeenCalledWith('/shopping/2025-01-06/')
  })

  it('propagates errors on failure', async () => {
    api.delete.mockRejectedValue(new Error('Server error'))

    await expect(clearList('2026-03-23')).rejects.toThrow('Server error')
  })
})
