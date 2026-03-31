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
    if (!raw) return defaultConfig()
    const saved = JSON.parse(raw)
    // If the user never explicitly chose a provider (old default of 'claude'),
    // re-evaluate: switch to browser if WebGPU is now available.
    if (!saved.userChoseProvider && saved.provider === 'claude') {
      const fresh = defaultConfig()
      if (fresh.provider === 'browser') return { ...saved, ...fresh }
    }
    return saved
  } catch {
    return defaultConfig()
  }
}

export default function useProviderConfig() {
  const [config, setConfig] = useState(loadProviderConfig)

  const update = useCallback((patch) => {
    setConfig((prev) => {
      // Mark as explicit choice whenever the user changes anything in the dialog
      const next = { ...prev, ...patch, userChoseProvider: true }
      localStorage.setItem(PROVIDER_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return [config, update]
}
