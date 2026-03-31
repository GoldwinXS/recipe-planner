import { useState, useCallback } from 'react'

export const PROVIDER_STORAGE_KEY = 'recipeAiProviderConfig'

function defaultConfig() {
  const webGpuSupported = typeof navigator !== 'undefined' && 'gpu' in navigator
  return {
    provider: webGpuSupported ? 'browser' : 'claude',
    model: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  }
}

export function loadProviderConfig() {
  try {
    const raw = localStorage.getItem(PROVIDER_STORAGE_KEY)
    return raw ? JSON.parse(raw) : defaultConfig()
  } catch {
    return defaultConfig()
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
