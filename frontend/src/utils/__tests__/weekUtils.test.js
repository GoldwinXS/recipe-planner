import { describe, it, expect } from 'vitest'
import {
  DAY_NAMES,
  MEAL_TYPES,
  getMonday,
  formatWeekStart,
  getWeekDays,
} from '../weekUtils'

describe('DAY_NAMES', () => {
  it('contains 7 day names starting with Monday', () => {
    expect(DAY_NAMES).toHaveLength(7)
    expect(DAY_NAMES[0]).toBe('Monday')
    expect(DAY_NAMES[6]).toBe('Sunday')
  })
})

describe('MEAL_TYPES', () => {
  it('contains the four expected meal types', () => {
    expect(MEAL_TYPES).toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
  })
})

describe('getMonday', () => {
  it('returns the same day when given a Monday', () => {
    // 2026-03-23 is a Monday
    const monday = new Date(2026, 2, 23)
    const result = getMonday(monday)
    expect(result.getDay()).toBe(1) // Monday
    expect(result.getDate()).toBe(23)
    expect(result.getMonth()).toBe(2)
    expect(result.getFullYear()).toBe(2026)
  })

  it('returns Monday when given a Wednesday', () => {
    // 2026-03-25 is a Wednesday
    const wed = new Date(2026, 2, 25)
    const result = getMonday(wed)
    expect(result.getDay()).toBe(1)
    expect(result.getDate()).toBe(23) // Monday of that week
  })

  it('returns Monday when given a Sunday', () => {
    // 2026-03-29 is a Sunday
    const sun = new Date(2026, 2, 29)
    const result = getMonday(sun)
    expect(result.getDay()).toBe(1)
    expect(result.getDate()).toBe(23)
  })

  it('returns Monday when given a Saturday', () => {
    // 2026-03-28 is a Saturday
    const sat = new Date(2026, 2, 28)
    const result = getMonday(sat)
    expect(result.getDay()).toBe(1)
    expect(result.getDate()).toBe(23)
  })

  it('returns Monday when given a Friday', () => {
    // 2026-03-27 is a Friday
    const fri = new Date(2026, 2, 27)
    const result = getMonday(fri)
    expect(result.getDay()).toBe(1)
    expect(result.getDate()).toBe(23)
  })

  it('zeroes out hours, minutes, seconds, and milliseconds', () => {
    const date = new Date(2026, 2, 25, 14, 30, 45, 500)
    const result = getMonday(date)
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
    expect(result.getMilliseconds()).toBe(0)
  })

  it('handles month boundary correctly (Monday in previous month)', () => {
    // 2026-04-01 is a Wednesday; Monday is 2026-03-30
    const wed = new Date(2026, 3, 1)
    const result = getMonday(wed)
    expect(result.getMonth()).toBe(2) // March
    expect(result.getDate()).toBe(30)
  })

  it('handles year boundary correctly', () => {
    // 2026-01-01 is a Thursday; Monday is 2025-12-29
    const jan1 = new Date(2026, 0, 1)
    const result = getMonday(jan1)
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(11) // December
    expect(result.getDate()).toBe(29)
  })

  it('does not mutate the original date', () => {
    const original = new Date(2026, 2, 25, 10, 30)
    const originalTime = original.getTime()
    getMonday(original)
    expect(original.getTime()).toBe(originalTime)
  })

  it('accepts a date string', () => {
    const result = getMonday('2026-03-25')
    expect(result.getDay()).toBe(1)
  })
})

describe('formatWeekStart', () => {
  it('formats a date as YYYY-MM-DD', () => {
    const date = new Date(2026, 2, 23)
    expect(formatWeekStart(date)).toBe('2026-03-23')
  })

  it('pads single-digit month with a leading zero', () => {
    const date = new Date(2026, 0, 5) // January 5
    expect(formatWeekStart(date)).toBe('2026-01-05')
  })

  it('pads single-digit day with a leading zero', () => {
    const date = new Date(2026, 8, 3) // September 3
    expect(formatWeekStart(date)).toBe('2026-09-03')
  })

  it('does not pad double-digit month or day', () => {
    const date = new Date(2026, 10, 15) // November 15
    expect(formatWeekStart(date)).toBe('2026-11-15')
  })

  it('handles December correctly', () => {
    const date = new Date(2025, 11, 29) // December 29
    expect(formatWeekStart(date)).toBe('2025-12-29')
  })
})

describe('getWeekDays', () => {
  it('returns an array of 7 dates', () => {
    const days = getWeekDays(new Date(2026, 2, 23))
    expect(days).toHaveLength(7)
  })

  it('starts on Monday and ends on Sunday', () => {
    const days = getWeekDays(new Date(2026, 2, 23))
    expect(days[0].getDay()).toBe(1) // Monday
    expect(days[6].getDay()).toBe(0) // Sunday
  })

  it('returns consecutive dates', () => {
    const days = getWeekDays(new Date(2026, 2, 23))
    for (let i = 1; i < days.length; i++) {
      // Handle month boundary by checking time difference
      const timeDiff = days[i].getTime() - days[i - 1].getTime()
      expect(timeDiff).toBe(24 * 60 * 60 * 1000)
    }
  })

  it('returns correct dates for a known week', () => {
    // Use local-time constructor to avoid UTC parsing issues
    // 2026-03-23 is a Monday
    const monday = new Date(2026, 2, 23)
    const days = getWeekDays(monday)
    expect(days[0].getDate()).toBe(23)
    expect(days[1].getDate()).toBe(24)
    expect(days[2].getDate()).toBe(25)
    expect(days[3].getDate()).toBe(26)
    expect(days[4].getDate()).toBe(27)
    expect(days[5].getDate()).toBe(28)
    expect(days[6].getDate()).toBe(29)
  })

  it('normalizes to Monday even if given a mid-week date', () => {
    // Give it Wednesday 2026-03-25, should still return Mon-Sun
    const days = getWeekDays(new Date(2026, 2, 25))
    expect(days[0].getDay()).toBe(1)
    expect(days[0].getDate()).toBe(23)
    expect(days[6].getDate()).toBe(29)
  })

  it('handles week that spans two months', () => {
    // 2026-03-30 is Monday, week goes into April
    // Use local-time constructor to avoid UTC parsing issues
    const monday = new Date(2026, 2, 30)
    const days = getWeekDays(monday)
    expect(days[0].getMonth()).toBe(2) // March 30
    expect(days[0].getDate()).toBe(30)
    expect(days[2].getMonth()).toBe(3) // April 1
    expect(days[2].getDate()).toBe(1)
  })

  it('returns Date objects', () => {
    const days = getWeekDays(new Date(2026, 2, 23))
    days.forEach((d) => {
      expect(d).toBeInstanceOf(Date)
    })
  })
})
