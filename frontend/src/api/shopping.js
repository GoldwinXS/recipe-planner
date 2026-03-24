import api from './axios'

export function getShoppingList(weekStart) {
  return api.get(`/shopping/${weekStart}/`)
}

export function toggleItem(weekStart, id) {
  return api.patch(`/shopping/${weekStart}/items/${id}/toggle/`)
}

export function clearList(weekStart) {
  return api.delete(`/shopping/${weekStart}/`)
}
