export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']

/**
 * Given any Date, return the Monday of that week as a Date.
 */
export function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sunday, 1 = Monday, ...
  // getDay() returns 0 for Sunday; treat Sunday as day 7
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Format a Date as YYYY-MM-DD string.
 */
export function formatWeekStart(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Return an array of 7 Date objects: Monday through Sunday of the week
 * that contains the given weekStart date.
 */
export function getWeekDays(weekStart) {
  const monday = getMonday(new Date(weekStart))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}
