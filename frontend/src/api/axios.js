import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Track whether a refresh is in progress to avoid duplicate refresh calls
let isRefreshing = false
let failedQueue = []

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

// Request interceptor: inject access token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// Response interceptor: handle 401 with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) {
        isRefreshing = false
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        const response = await axios.post('/api/auth/refresh/', {
          refresh: refreshToken,
        })
        const { access } = response.data
        localStorage.setItem('access_token', access)
        api.defaults.headers.common.Authorization = `Bearer ${access}`
        processQueue(null, access)
        originalRequest.headers.Authorization = `Bearer ${access}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    // Build a user-friendly error message
    if (!error.response) {
      error.userMessage = 'Unable to connect to server. Please check your connection.'
    } else if (error.response.status === 403) {
      error.userMessage = 'You do not have permission to perform this action.'
    } else if (error.response.status === 404) {
      error.userMessage = 'The requested resource was not found.'
    } else if (error.response.status >= 500) {
      error.userMessage = 'A server error occurred. Please try again later.'
    } else if (error.response.data?.detail) {
      error.userMessage = error.response.data.detail
    } else if (error.response.data?.non_field_errors) {
      error.userMessage = error.response.data.non_field_errors.join(' ')
    } else if (error.response.data && typeof error.response.data === 'object') {
      // Surface field-level validation errors from DRF
      const messages = Object.entries(error.response.data)
        .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(', ') : errs}`)
        .join(' | ')
      error.userMessage = messages || 'An unexpected error occurred.'
    } else {
      error.userMessage = 'An unexpected error occurred.'
    }

    return Promise.reject(error)
  },
)

export default api
