import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  Chip,
  Typography,
  LinearProgress,
  Box,
} from '@mui/material'
import MemoryIcon from '@mui/icons-material/Memory'
import { getOllamaModels } from '../../api/recipes'
import useProviderConfig from '../../hooks/useProviderConfig'
import { useWebLLM } from '../../contexts/WebLLMContext'
import { BROWSER_MODELS } from '../../utils/browserLLM'

export default function AIProviderDialog({ open, onClose }) {
  const [config, update] = useProviderConfig()
  const [ollamaModels, setOllamaModels] = useState([])
  const [ollamaTestStatus, setOllamaTestStatus] = useState(null)
  const [ollamaTestMsg, setOllamaTestMsg] = useState('')
  const [llmError, setLlmError] = useState(null)

  const { status: llmStatus, loadedModel, progress: llmProgress, webGpuSupported, loadModel, unloadModel } = useWebLLM()

  const handleTestOllama = async () => {
    setOllamaTestStatus('loading')
    setOllamaModels([])
    try {
      const res = await getOllamaModels(config.ollama_url)
      const models = res.data.models || []
      setOllamaModels(models)
      setOllamaTestStatus('ok')
      setOllamaTestMsg(`Connected — ${models.length} model${models.length !== 1 ? 's' : ''} found`)
    } catch (err) {
      setOllamaTestStatus('error')
      setOllamaTestMsg(err.response?.data?.detail || 'Could not connect to Ollama.')
    }
  }

  const handleLoadBrowserModel = async () => {
    setLlmError(null)
    const modelId = config.model || BROWSER_MODELS[0].id
    try {
      await loadModel(modelId)
    } catch (err) {
      setLlmError(err.message || 'Failed to load model.')
    }
  }

  const providerLabel =
    config.provider === 'claude' ? 'Claude (Anthropic API)' :
    config.provider === 'ollama' ? `Ollama — ${config.model || 'no model set'}` :
    config.provider === 'browser' ? `Browser — ${BROWSER_MODELS.find((m) => m.id === config.model)?.label?.split(' — ')[0] || 'no model set'}` :
    `OpenAI-compatible — ${config.model || 'no model set'}`

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        AI Provider Settings
        <Typography variant="caption" display="block" color="text.secondary">
          {providerLabel}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Provider</InputLabel>
            <Select
              value={config.provider}
              label="Provider"
              onChange={(e) => {
                update({ provider: e.target.value })
                setOllamaTestStatus(null)
                setOllamaModels([])
                setLlmError(null)
              }}
            >
              <MenuItem value="claude">Claude (Anthropic API)</MenuItem>
              <MenuItem value="ollama">Ollama (local)</MenuItem>
              <MenuItem value="openai_compatible">OpenAI-compatible API</MenuItem>
              <MenuItem value="browser">Browser (WebGPU — runs locally)</MenuItem>
            </Select>
          </FormControl>

          {config.provider === 'claude' && (
            <Alert severity="info" sx={{ py: 0.5 }}>
              Uses the <strong>ANTHROPIC_API_KEY</strong> configured on the server. No additional settings required.
            </Alert>
          )}

          {config.provider === 'ollama' && (
            <>
              <Alert severity="info" sx={{ py: 0.5 }}>
                <strong>New to Ollama?</strong>{' '}
                Download at ollama.com, then run <code>ollama pull llama3.2</code>.
                If running in Docker, use <code>http://host.docker.internal:11434</code>.
              </Alert>

              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  label="Ollama Server URL"
                  placeholder="http://host.docker.internal:11434"
                  value={config.ollama_url || ''}
                  onChange={(e) => {
                    update({ ollama_url: e.target.value })
                    setOllamaTestStatus(null)
                    setOllamaModels([])
                  }}
                  fullWidth
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleTestOllama}
                  disabled={!config.ollama_url || ollamaTestStatus === 'loading'}
                  sx={{ whiteSpace: 'nowrap', px: 2 }}
                >
                  {ollamaTestStatus === 'loading' ? 'Testing…' : 'Test & Browse'}
                </Button>
              </Stack>

              {ollamaTestStatus === 'ok' && (
                <Alert severity="success" sx={{ py: 0.5 }}>{ollamaTestMsg}</Alert>
              )}
              {ollamaTestStatus === 'error' && (
                <Alert severity="error" sx={{ py: 0.5 }}>{ollamaTestMsg}</Alert>
              )}

              {ollamaModels.length > 0 ? (
                <FormControl size="small" fullWidth>
                  <InputLabel>Model</InputLabel>
                  <Select
                    value={config.model || ''}
                    label="Model"
                    onChange={(e) => update({ model: e.target.value })}
                  >
                    {ollamaModels.map((m) => (
                      <MenuItem key={m} value={m}>{m}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <TextField
                  size="small"
                  label="Model name"
                  placeholder="llama3.2 (or click Test & Browse)"
                  value={config.model || ''}
                  onChange={(e) => update({ model: e.target.value })}
                  fullWidth
                  helperText="Click 'Test & Browse' to see models on your server"
                />
              )}
            </>
          )}

          {config.provider === 'openai_compatible' && (
            <>
              <TextField
                size="small"
                label="API Base URL"
                placeholder="https://api.groq.com/openai"
                value={config.api_base || ''}
                onChange={(e) => update({ api_base: e.target.value })}
                fullWidth
              />
              <TextField
                size="small"
                label="Model name"
                placeholder="llama-3.3-70b-versatile"
                value={config.model || ''}
                onChange={(e) => update({ model: e.target.value })}
                fullWidth
              />
              <TextField
                size="small"
                label="API Key (optional)"
                placeholder="sk-..."
                type="password"
                value={config.api_key || ''}
                onChange={(e) => update({ api_key: e.target.value })}
                fullWidth
              />
            </>
          )}

          {config.provider === 'browser' && (
            <>
              {!webGpuSupported && (
                <Alert severity="warning" sx={{ py: 0.5 }}>
                  <strong>WebGPU not detected.</strong> This feature requires Chrome 113+ or Edge 113+.
                </Alert>
              )}

              <Alert severity="info" sx={{ py: 0.5 }}>
                Downloads and runs a real LLM in your browser. No API key needed — 100% private.
                The model is cached after the first download.
              </Alert>

              <FormControl size="small" fullWidth disabled={llmStatus === 'loading'}>
                <InputLabel>Model</InputLabel>
                <Select
                  value={config.model || BROWSER_MODELS[0].id}
                  label="Model"
                  onChange={(e) => update({ model: e.target.value })}
                >
                  {BROWSER_MODELS.map((m) => (
                    <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {llmError && (
                <Alert severity="error" sx={{ py: 0.5 }} onClose={() => setLlmError(null)}>
                  {llmError}
                </Alert>
              )}

              {llmStatus === 'idle' && (
                <Button
                  variant="outlined"
                  startIcon={<MemoryIcon />}
                  onClick={handleLoadBrowserModel}
                  disabled={!webGpuSupported}
                  size="small"
                >
                  Load Model into Browser
                </Button>
              )}

              {llmStatus === 'loading' && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {llmProgress.text || 'Downloading…'}
                  </Typography>
                  <LinearProgress
                    variant={llmProgress.value > 0 ? 'determinate' : 'indeterminate'}
                    value={llmProgress.value}
                    sx={{ mt: 0.5, borderRadius: 1 }}
                  />
                  {llmProgress.value > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      {llmProgress.value}% — cached after first download
                    </Typography>
                  )}
                </Box>
              )}

              {llmStatus === 'ready' && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Alert severity="success" sx={{ py: 0.25, px: 1.5, flex: 1 }}>
                    Model ready: {BROWSER_MODELS.find((m) => m.id === loadedModel)?.label?.split(' — ')[0] || loadedModel}
                  </Alert>
                  <Button size="small" variant="outlined" onClick={unloadModel}>
                    Unload
                  </Button>
                </Stack>
              )}

              {llmStatus !== 'ready' && (
                <Typography variant="caption" color="text.secondary">
                  Load the model above to use it for recipe generation and parsing.
                </Typography>
              )}
            </>
          )}

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">Active:</Typography>
            <Chip
              label={providerLabel}
              size="small"
              color={config.provider === 'claude' ? 'secondary' : 'primary'}
              variant="outlined"
            />
            {config.provider === 'browser' && llmStatus === 'ready' && (
              <Chip label="Model loaded" size="small" color="success" />
            )}
            {config.provider === 'browser' && llmStatus === 'idle' && (
              <Chip label="Not loaded" size="small" color="warning" variant="outlined" />
            )}
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">Done</Button>
      </DialogActions>
    </Dialog>
  )
}
