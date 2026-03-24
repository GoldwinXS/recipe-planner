import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useContext } from 'react'
import { AuthContext, AuthProvider } from '../AuthContext'

vi.mock('../../api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
  refresh: vi.fn(),
  demoLogin: vi.fn(),
  deleteAccount: vi.fn(),
  getProfile: vi.fn(),
}))

import {
  login as apiLogin,
  register as apiRegister,
  refresh as apiRefresh,
  demoLogin as apiDemoLogin,
  deleteAccount as apiDeleteAccount,
  getProfile as apiGetProfile,
} from '../../api/auth'

// Helper: build a fake JWT with given payload
function fakeJwt(payload) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.fake-signature`
}

// Helper component that consumes AuthContext and exposes controls
function TestConsumer() {
  const ctx = useContext(AuthContext)
  if (ctx.loading) return <div data-testid="loading">Loading...</div>
  return (
    <div>
      <div data-testid="user">{ctx.user ? JSON.stringify(ctx.user) : 'null'}</div>
      <div data-testid="isAuthenticated">{String(ctx.isAuthenticated)}</div>
      <button data-testid="login-btn" onClick={() => ctx.login({ username: 'alice', password: 'pass' })}>
        Login
      </button>
      <button data-testid="demo-btn" onClick={() => ctx.demoLogin()}>
        Demo
      </button>
      <button data-testid="register-btn" onClick={() => ctx.register({ username: 'bob', password: 'pass' })}>
        Register
      </button>
      <button data-testid="logout-btn" onClick={() => ctx.logout()}>
        Logout
      </button>
    </div>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  apiGetProfile.mockResolvedValue({ data: {} })
})

afterEach(() => {
  localStorage.clear()
})

describe('AuthProvider', () => {
  describe('initial loading state', () => {
    it('shows loading true initially when no tokens exist', async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      // Loading resolves quickly since there's no token
      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      })
    })

    it('shows loading then resolves when token exists in localStorage', async () => {
      const token = fakeJwt({
        user_id: 1,
        username: 'alice',
        email: 'alice@test.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
      localStorage.setItem('access_token', token)
      localStorage.setItem('refresh_token', 'ref-tok')

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      })

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('true')
    })
  })

  describe('login', () => {
    it('stores tokens in localStorage and sets user', async () => {
      const accessToken = fakeJwt({
        user_id: 1,
        username: 'alice',
        email: 'alice@test.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
      apiLogin.mockResolvedValue({
        data: { access: accessToken, refresh: 'refresh-tok', user: null },
      })

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      })

      await act(async () => {
        await userEvent.click(screen.getByTestId('login-btn'))
      })

      expect(localStorage.getItem('access_token')).toBe(accessToken)
      expect(localStorage.getItem('refresh_token')).toBe('refresh-tok')

      await waitFor(() => {
        const user = JSON.parse(screen.getByTestId('user').textContent)
        expect(user.username).toBe('alice')
        expect(user.id).toBe(1)
      })
    })

    it('merges user data from response into context', async () => {
      const accessToken = fakeJwt({
        user_id: 2,
        username: 'bob',
        email: 'bob@test.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
      apiLogin.mockResolvedValue({
        data: {
          access: accessToken,
          refresh: 'ref',
          user: { cooking_days: [1, 3, 5] },
        },
      })

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      })

      await act(async () => {
        await userEvent.click(screen.getByTestId('login-btn'))
      })

      await waitFor(() => {
        const user = JSON.parse(screen.getByTestId('user').textContent)
        expect(user.cooking_days).toEqual([1, 3, 5])
      })
    })
  })

  describe('logout', () => {
    it('clears tokens from localStorage and sets user to null', async () => {
      const accessToken = fakeJwt({
        user_id: 1,
        username: 'alice',
        email: 'alice@test.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
      apiLogin.mockResolvedValue({
        data: { access: accessToken, refresh: 'ref', user: null },
      })

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      })

      // Login first
      await act(async () => {
        await userEvent.click(screen.getByTestId('login-btn'))
      })

      await waitFor(() => {
        expect(screen.getByTestId('isAuthenticated').textContent).toBe('true')
      })

      // Then logout
      await act(async () => {
        await userEvent.click(screen.getByTestId('logout-btn'))
      })

      expect(localStorage.getItem('access_token')).toBeNull()
      expect(localStorage.getItem('refresh_token')).toBeNull()
      expect(screen.getByTestId('user').textContent).toBe('null')
      expect(screen.getByTestId('isAuthenticated').textContent).toBe('false')
    })

    it('calls deleteAccount for demo temp users on logout', async () => {
      const accessToken = fakeJwt({
        user_id: 99,
        username: 'demo_user',
        email: 'demo@test.com',
        is_demo_temp: true,
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
      apiDemoLogin.mockResolvedValue({
        data: { access: accessToken, refresh: 'demo-ref', user: null },
      })
      apiDeleteAccount.mockResolvedValue({})

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      })

      await act(async () => {
        await userEvent.click(screen.getByTestId('demo-btn'))
      })

      await waitFor(() => {
        const user = JSON.parse(screen.getByTestId('user').textContent)
        expect(user.is_demo_temp).toBe(true)
      })

      await act(async () => {
        await userEvent.click(screen.getByTestId('logout-btn'))
      })

      expect(apiDeleteAccount).toHaveBeenCalled()
    })
  })

  describe('expired token triggers refresh', () => {
    it('refreshes an expired access token on mount', async () => {
      const expiredToken = fakeJwt({
        user_id: 1,
        username: 'alice',
        email: 'alice@test.com',
        exp: Math.floor(Date.now() / 1000) - 60, // expired 60 seconds ago
      })
      const newToken = fakeJwt({
        user_id: 1,
        username: 'alice',
        email: 'alice@test.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
      localStorage.setItem('access_token', expiredToken)
      localStorage.setItem('refresh_token', 'valid-refresh')

      apiRefresh.mockResolvedValue({ data: { access: newToken } })

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      })

      expect(apiRefresh).toHaveBeenCalledWith('valid-refresh')
      expect(localStorage.getItem('access_token')).toBe(newToken)

      await waitFor(() => {
        const user = JSON.parse(screen.getByTestId('user').textContent)
        expect(user.username).toBe('alice')
      })
    })

    it('clears tokens and sets user to null when refresh fails', async () => {
      const expiredToken = fakeJwt({
        user_id: 1,
        username: 'alice',
        email: 'alice@test.com',
        exp: Math.floor(Date.now() / 1000) - 60,
      })
      localStorage.setItem('access_token', expiredToken)
      localStorage.setItem('refresh_token', 'bad-refresh')

      apiRefresh.mockRejectedValue(new Error('Refresh failed'))

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      })

      expect(screen.getByTestId('user').textContent).toBe('null')
      expect(localStorage.getItem('access_token')).toBeNull()
      expect(localStorage.getItem('refresh_token')).toBeNull()
    })

    it('clears tokens when expired token has no refresh token', async () => {
      const expiredToken = fakeJwt({
        user_id: 1,
        username: 'alice',
        email: 'alice@test.com',
        exp: Math.floor(Date.now() / 1000) - 60,
      })
      localStorage.setItem('access_token', expiredToken)
      // No refresh token set

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      })

      expect(screen.getByTestId('user').textContent).toBe('null')
      expect(apiRefresh).not.toHaveBeenCalled()
    })
  })

  describe('register', () => {
    it('registers and then logs in automatically', async () => {
      const accessToken = fakeJwt({
        user_id: 3,
        username: 'bob',
        email: 'bob@test.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
      apiRegister.mockResolvedValue({ data: { id: 3 } })
      apiLogin.mockResolvedValue({
        data: { access: accessToken, refresh: 'ref', user: null },
      })

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      })

      await act(async () => {
        await userEvent.click(screen.getByTestId('register-btn'))
      })

      expect(apiRegister).toHaveBeenCalledWith({ username: 'bob', password: 'pass' })
      expect(apiLogin).toHaveBeenCalledWith({ username: 'bob', password: 'pass' })

      await waitFor(() => {
        const user = JSON.parse(screen.getByTestId('user').textContent)
        expect(user.username).toBe('bob')
      })
    })
  })

  describe('invalid token handling', () => {
    it('clears state when access token is malformed', async () => {
      localStorage.setItem('access_token', 'not-a-jwt')
      localStorage.setItem('refresh_token', 'ref')

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      })

      expect(screen.getByTestId('user').textContent).toBe('null')
      expect(localStorage.getItem('access_token')).toBeNull()
    })
  })

  describe('no token on mount', () => {
    it('finishes loading with user as null when no tokens in localStorage', async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      })

      expect(screen.getByTestId('user').textContent).toBe('null')
      expect(screen.getByTestId('isAuthenticated').textContent).toBe('false')
    })
  })
})
