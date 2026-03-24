import api from './axios'

export function register(data) {
  return api.post('/auth/register/', data)
}

export function login(data) {
  return api.post('/auth/login/', data)
}

export function refresh(token) {
  return api.post('/auth/refresh/', { refresh: token })
}

export function getProfile() {
  return api.get('/auth/me/')
}

export function updateProfile(data) {
  return api.patch('/auth/me/', data)
}

export function demoLogin() {
  return api.post('/auth/demo/')
}

export function deleteAccount() {
  return api.delete('/auth/me/')
}
