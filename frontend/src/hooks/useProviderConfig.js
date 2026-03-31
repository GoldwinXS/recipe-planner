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
    const saved = raw ? JSON.parse(raw) : defaultConfig()
    // If provider is claude but no API key is set, use browser when WebGPU is available.
    // Claude without a key will always 503; browser works for free.
    const webGpuSupported = typeof navigator !== 'undefined' && 'gpu' in navigator
    if (webGpuSupported && saved.provider === 'claude' && !saved.api_key) {
      return {
        ...saved,
        provider: 'browser',
        model: saved.model && !saved.model.startsWith('claude') ? saved.model : 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
      }
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
