import { createContext, useContext, useRef, useState, useCallback } from 'react'

const WebLLMContext = createContext(null)

export function WebLLMProvider({ children }) {
  const engineRef = useRef(null)
  const workerRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle | loading | ready
  const [progress, setProgress] = useState({ text: '', value: 0 })
  const [loadedModel, setLoadedModel] = useState(null)

  const webGpuSupported = typeof navigator !== 'undefined' && 'gpu' in navigator

  const loadModel = useCallback(async (modelId) => {
    if (!webGpuSupported) throw new Error('WebGPU is not available. Use Chrome 113+ or Edge 113+.')
    setStatus('loading')
    setProgress({ text: 'Initialising…', value: 0 })
    setLoadedModel(null)

    // Unload any existing worker first
    if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null }
    engineRef.current = null

    try {
      let CreateWebWorkerMLCEngine
      try {
        ;({ CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm'))
      } catch {
        throw new Error('Could not load WebLLM library. Check browser supports WebGPU.')
      }

      const worker = new Worker(
        new URL('../workers/webllm.worker.js', import.meta.url),
        { type: 'module' },
      )
      workerRef.current = worker

      const engine = await CreateWebWorkerMLCEngine(worker, modelId, {
        initProgressCallback: ({ progress: p, text }) => {
          setProgress({ value: Math.round(p * 100), text })
        },
      })
      engineRef.current = engine
      setLoadedModel(modelId)
      setStatus('ready')
    } catch (err) {
      setStatus('idle')
      setProgress({ text: '', value: 0 })
      if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null }
      throw err
    }
  }, [webGpuSupported])

  const unloadModel = useCallback(() => {
    if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null }
    engineRef.current = null
    setStatus('idle')
    setProgress({ text: '', value: 0 })
    setLoadedModel(null)
  }, [])

  const generate = useCallback(async (messages, opts = {}) => {
    if (!engineRef.current) throw new Error('Browser model not loaded.')
    const reply = await engineRef.current.chat.completions.create({
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.max_tokens ?? 2048,
    })
    return reply.choices[0].message.content
  }, [])

  return (
    <WebLLMContext.Provider value={{ status, progress, loadedModel, webGpuSupported, loadModel, unloadModel, generate }}>
      {children}
    </WebLLMContext.Provider>
  )
}

export function useWebLLM() {
  const ctx = useContext(WebLLMContext)
  if (!ctx) throw new Error('useWebLLM must be used within WebLLMProvider')
  return ctx
}
