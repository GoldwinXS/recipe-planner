import { createContext, useState, useEffect, useCallback } from 'react'
import {
  login as apiLogin,
  register as apiRegister,
  refresh as apiRefresh,
  demoLogin as apiDemoLogin,
  deleteAccount as apiDeleteAccount,
  getProfile as apiGetProfile,
} from '../api/auth'

export const AuthContext = createContext(null)

function decodeToken(token) {
  try {
    const payload = token.split('.')[1]
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/')
    const jsonStr = atob(padded)
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}

function isTokenExpired(decoded) {
  if (!decoded || !decoded.exp) return true
  return decoded.exp * 1000 < Date.now()
}

function userFromDecoded(decoded) {
  if (!decoded) return null
  return {
    id:           decoded.user_id,
    username:     decoded.username,
    email:        decoded.email,
    is_demo_temp: decoded.is_demo_temp ?? false,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const _clearTokens = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }

  const logout = useCallback(async () => {
    const currentUser = user
    // Clear state first so UI transitions immediately
    setUser(null)
    _clearTokens()
    // If it was a demo temp account, delete it from the server
    if (currentUser?.is_demo_temp) {
      try { await apiDeleteAccount() } catch { /* already logged out, ignore */ }
    }
  }, [user])

  const loadUserFromToken = useCallback(
    async (accessToken, refreshToken) => {
      const decoded = decodeToken(accessToken)
      if (!decoded) {
        _clearTokens()
        setUser(null)
        return false
      }

      if (isTokenExpired(decoded)) {
        if (!refreshToken) {
          _clearTokens()
          setUser(null)
          return false
        }
        try {
          const response = await apiRefresh(refreshToken)
          const newAccess = response.data.access
          localStorage.setItem('access_token', newAccess)
          const newDecoded = decodeToken(newAccess)
          if (newDecoded) {
            setUser(userFromDecoded(newDecoded))
            return true
          }
          _clearTokens()
          setUser(null)
          return false
        } catch {
          _clearTokens()
          setUser(null)
          return false
        }
      }

      setUser(userFromDecoded(decoded))
      // Hydrate extra profile fields (macro goals, cooking_days) that aren't in the JWT
      apiGetProfile().then((res) => {
        setUser((prev) => (prev ? { ...prev, ...res.data } : prev))
      }).catch(() => {})
      return true
    },
    [],
  )

  useEffect(() => {
    const accessToken = localStorage.getItem('access_token')
    const refreshToken = localStorage.getItem('refresh_token')
    if (accessToken) {
      loadUserFromToken(accessToken, refreshToken).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [loadUserFromToken])

  const login = useCallback(async (credentials) => {
    const response = await apiLogin(credentials)
    const { access, refresh, user: userData } = response.data
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
    setUser({ ...userFromDecoded(decodeToken(access)), ...(userData || {}) })
    return response
  }, [])

  const demoLogin = useCallback(async () => {
    const response = await apiDemoLogin()
    const { access, refresh, user: userData } = response.data
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
    setUser({ ...userFromDecoded(decodeToken(access)), ...(userData || {}) })
    return response
  }, [])

  const register = useCallback(async (data) => {
    await apiRegister(data)
    const loginResponse = await apiLogin({ username: data.username, password: data.password })
    const { access, refresh, user: userData } = loginResponse.data
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
    setUser({ ...userFromDecoded(decodeToken(access)), ...(userData || {}) })
    return loginResponse
  }, [])

  const updateUser = useCallback((partial) => {
    setUser((prev) => prev ? { ...prev, ...partial } : prev)
  }, [])

  const value = {
    user,
    loading,
    login,
    demoLogin,
    logout,
    register,
    updateUser,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
