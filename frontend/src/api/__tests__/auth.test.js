import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  register,
  login,
  refresh,
  getProfile,
  updateProfile,
  demoLogin,
  deleteAccount,
} from '../auth'

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

describe('register', () => {
  it('sends POST to /auth/register/ with data', async () => {
    const data = { username: 'alice', password: 'secret123', email: 'alice@test.com' }
    api.post.mockResolvedValue({ data: { id: 1 } })

    const result = await register(data)

    expect(api.post).toHaveBeenCalledWith('/auth/register/', data)
    expect(result.data).toEqual({ id: 1 })
  })

  it('propagates errors from the API', async () => {
    const error = new Error('Validation failed')
    api.post.mockRejectedValue(error)

    await expect(register({ username: '' })).rejects.toThrow('Validation failed')
  })
})

describe('login', () => {
  it('sends POST to /auth/login/ with credentials', async () => {
    const credentials = { username: 'alice', password: 'secret123' }
    const mockResponse = { data: { access: 'tok', refresh: 'ref' } }
    api.post.mockResolvedValue(mockResponse)

    const result = await login(credentials)

    expect(api.post).toHaveBeenCalledWith('/auth/login/', credentials)
    expect(result).toBe(mockResponse)
  })

  it('returns access and refresh tokens on success', async () => {
    api.post.mockResolvedValue({
      data: { access: 'access-token', refresh: 'refresh-token' },
    })

    const result = await login({ username: 'u', password: 'p' })

    expect(result.data.access).toBe('access-token')
    expect(result.data.refresh).toBe('refresh-token')
  })
})

describe('refresh', () => {
  it('sends POST to /auth/refresh/ with refresh token in body', async () => {
    api.post.mockResolvedValue({ data: { access: 'new-access' } })

    const result = await refresh('my-refresh-token')

    expect(api.post).toHaveBeenCalledWith('/auth/refresh/', {
      refresh: 'my-refresh-token',
    })
    expect(result.data.access).toBe('new-access')
  })

  it('rejects when refresh token is invalid', async () => {
    api.post.mockRejectedValue(new Error('Token is invalid'))

    await expect(refresh('bad-token')).rejects.toThrow('Token is invalid')
  })
})

describe('getProfile', () => {
  it('sends GET to /auth/me/', async () => {
    const profile = { id: 1, username: 'alice', email: 'alice@test.com' }
    api.get.mockResolvedValue({ data: profile })

    const result = await getProfile()

    expect(api.get).toHaveBeenCalledWith('/auth/me/')
    expect(result.data).toEqual(profile)
  })
})

describe('updateProfile', () => {
  it('sends PATCH to /auth/me/ with partial data', async () => {
    const data = { email: 'new@test.com' }
    api.patch.mockResolvedValue({ data: { id: 1, email: 'new@test.com' } })

    const result = await updateProfile(data)

    expect(api.patch).toHaveBeenCalledWith('/auth/me/', data)
    expect(result.data.email).toBe('new@test.com')
  })
})

describe('demoLogin', () => {
  it('sends POST to /auth/demo/ with no data', async () => {
    const mockResponse = {
      data: { access: 'demo-access', refresh: 'demo-refresh' },
    }
    api.post.mockResolvedValue(mockResponse)

    const result = await demoLogin()

    expect(api.post).toHaveBeenCalledWith('/auth/demo/')
    expect(result.data.access).toBe('demo-access')
  })
})

describe('deleteAccount', () => {
  it('sends DELETE to /auth/me/', async () => {
    api.delete.mockResolvedValue({ data: null, status: 204 })

    const result = await deleteAccount()

    expect(api.delete).toHaveBeenCalledWith('/auth/me/')
    expect(result.status).toBe(204)
  })

  it('propagates errors on failure', async () => {
    api.delete.mockRejectedValue(new Error('Forbidden'))

    await expect(deleteAccount()).rejects.toThrow('Forbidden')
  })
})
