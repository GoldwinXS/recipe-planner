import { useState, useCallback } from 'react'

export const PROVIDER_STORAGE_KEY = 'recipeAiProviderConfig'

export function loadProviderConfig() {
  try {
    const raw = localStorage.getItem(PROVIDER_STORAGE_KEY)
    return raw ? JSON.parse(raw) : { provider: 'claude' }
  } catch {
    return { provider: 'claude' }
  }
}

export default function useProviderConfig() {
  const [config, setConfig] = useState(loadProviderConfig)

  const update = useCallback((patch) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch }
      localStorage.setItem(PROVIDER_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return [config, update]
}
