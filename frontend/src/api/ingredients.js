import api from './axios'

export function listIngredients(search = '') {
  return api.get('/ingredients/', { params: search ? { search } : {} })
}

export function createIngredient(data) {
  return api.post('/ingredients/', data)
}
