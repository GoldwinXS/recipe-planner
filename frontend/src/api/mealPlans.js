import api from './axios'

export function listMealPlans() {
  return api.get('/meal-plans/')
}

export function getMealPlan(weekStart) {
  return api.get(`/meal-plans/${weekStart}/`)
}

export function addEntry(weekStart, data) {
  return api.post(`/meal-plans/${weekStart}/entries/`, data)
}

export function removeEntry(weekStart, entryId) {
  return api.delete(`/meal-plans/${weekStart}/entries/${entryId}/`)
}

export function suggestMealPlan(providerConfig = {}, preferences = '', days = 7) {
  return api.post('/meal-plans/suggest/', { ...providerConfig, preferences, days })
}

export function getMealPlanStats(weekStart) {
  return api.get(`/meal-plans/${weekStart}/stats/`)
}

export function getMealPlanPrepGuide(weekStart, providerConfig = {}) {
  return api.post(`/meal-plans/${weekStart}/prep-guide/`, providerConfig)
}
