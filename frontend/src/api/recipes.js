import api from './axios'

export function listRecipes(params = {}) {
  return api.get('/recipes/', { params })
}

export function getRecipe(id) {
  return api.get(`/recipes/${id}/`)
}

export function createRecipe(data) {
  return api.post('/recipes/', data)
}

export function updateRecipe(id, data) {
  return api.put(`/recipes/${id}/`, data)
}

export function deleteRecipe(id) {
  return api.delete(`/recipes/${id}/`)
}

export function generateRecipe(prompt, providerConfig = {}) {
  return api.post('/recipes/generate/', { prompt, ...providerConfig })
}

export function saveGeneratedRecipe(data) {
  return api.post('/recipes/save-generated/', data)
}

export function listTags() {
  return api.get('/recipes/tags/')
}

export function fetchRecipeUrl(url) {
  return api.post('/recipes/fetch-url/', { url })
}

export function getOllamaModels(ollama_url) {
  return api.post('/ai/ollama-models/', { ollama_url })
}

export function fillRecipeMacros(id, providerConfig = {}) {
  return api.post(`/recipes/${id}/fill-macros/`, providerConfig)
}

export function remixRecipe(id, instruction, providerConfig = {}) {
  return api.post(`/recipes/${id}/remix/`, { instruction, ...providerConfig })
}
