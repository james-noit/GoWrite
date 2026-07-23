import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { providerRegistry } from '../lib/ai/providers'
import { testConnection } from '../lib/ai/testConnection'
import { aiConfigStorage } from '../lib/storage'
import type { AiConfig, AiProviderId, ConnectionStatus } from '../types'

const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000

function defaultConfig(): AiConfig {
  const stored = aiConfigStorage.get()
  if (stored) return stored
  return { provider: 'OpenAI', apiKey: '', customEndpoint: '', model: '' }
}

export function useAiConnection() {
  const [config, setConfig] = useState<AiConfig>(defaultConfig)
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [models, setModels] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const connectSeq = useRef(0)
  const configRef = useRef(config)
  configRef.current = config

  const meta = providerRegistry[config.provider]

  const setProvider = useCallback((provider: AiProviderId) => {
    connectSeq.current += 1
    setConfig((prev) => ({ ...prev, provider }))
    setStatus('idle')
    setError(null)
    setModels([])
  }, [])

  const updateField = useCallback((field: 'apiKey' | 'customEndpoint' | 'model', value: string) => {
    // Picking a different already-fetched model doesn't invalidate the live connection;
    // changing the key/endpoint does, since it means talking to a different account/server.
    if (field === 'model') {
      setConfig((prev) => {
        const next = { ...prev, model: value }
        aiConfigStorage.set(next)
        return next
      })
      return
    }
    connectSeq.current += 1
    setConfig((prev) => ({ ...prev, [field]: value }))
    setStatus('idle')
    setError(null)
  }, [])

  const connect = useCallback(async () => {
    setError(null)
    const current = config
    const providerMeta = providerRegistry[current.provider]

    if (providerMeta.endpointEditable) {
      const endpoint = current.customEndpoint.trim() || providerMeta.defaultEndpoint
      try {
        new URL(endpoint)
      } catch {
        setStatus('error')
        setError('La URL del endpoint no es válida.')
        return
      }
    }
    if (providerMeta.requiresApiKey && !current.apiKey.trim()) {
      setStatus('error')
      setError(`${providerMeta.apiKeyLabel} es obligatoria.`)
      return
    }

    const seq = ++connectSeq.current
    setStatus('connecting')

    try {
      const fetchedModels = await testConnection(current)
      if (connectSeq.current !== seq) return
      setModels(fetchedModels)
      setStatus('connected')

      // Default to a real model as soon as we know one: keep the user's choice if still valid,
      // otherwise fall back to the first available model, or the provider's hardcoded default.
      setConfig((prev) => {
        const next =
          prev.model && fetchedModels.includes(prev.model)
            ? prev
            : { ...prev, model: fetchedModels[0] ?? prev.model }
        aiConfigStorage.set(next)
        return next
      })
    } catch (err) {
      if (connectSeq.current !== seq) return
      setStatus('error')
      setError((err as Error).message || 'No se pudo conectar con el proveedor.')
    }
  }, [config])

  const disconnect = useCallback(() => {
    connectSeq.current += 1
    setStatus('idle')
    setError(null)
    abortRef.current?.abort()
  }, [])

  // While connected, re-check the provider every 5 minutes so the status icon stays truthful.
  useEffect(() => {
    if (status !== 'connected') return
    const seq = connectSeq.current
    const id = window.setInterval(() => {
      void (async () => {
        try {
          const fetchedModels = await testConnection(configRef.current)
          if (connectSeq.current !== seq) return
          setModels(fetchedModels)
        } catch (err) {
          if (connectSeq.current !== seq) return
          setStatus('error')
          setError(`Conexión perdida con el proveedor: ${(err as Error).message}`)
        }
      })()
    }, HEALTH_CHECK_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [status])

  const isConnected = status === 'connected'

  return useMemo(
    () => ({ config, meta, status, error, models, isConnected, setProvider, updateField, connect, disconnect, abortRef }),
    [config, meta, status, error, models, isConnected, setProvider, updateField, connect, disconnect],
  )
}

export type UseAiConnection = ReturnType<typeof useAiConnection>
