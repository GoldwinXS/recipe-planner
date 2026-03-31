import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  TextField,
  Grid,
  Chip,
  Stack,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Alert,
  Tooltip,
  IconButton,
} from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import SaveIcon from '@mui/icons-material/Save'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PeopleIcon from '@mui/icons-material/People'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ContentPasteIcon from '@mui/icons-material/ContentPaste'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import LinkIcon from '@mui/icons-material/Link'
import { generateRecipe, saveGeneratedRecipe, fetchRecipeUrl } from '../api/recipes'
import { recipeGenStore } from '../state/generationStore'
import ErrorAlert from '../components/common/ErrorAlert'
import useProviderConfig from '../hooks/useProviderConfig'
import useAuth from '../hooks/useAuth'
import { useWebLLM } from '../contexts/WebLLMContext'
import { BROWSER_MODELS, BROWSER_SYSTEM_PROMPT, BROWSER_MAX_PARSE_CHARS, MAX_PARSE_CHARS } from '../utils/browserLLM'

function tryParseJson(text) {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try { return JSON.parse(cleaned) } catch { return null }
}

const MAX_CHARS = 500

const JSON_PROMPT = `Please respond ONLY with valid JSON in this exact structure — no preamble, no markdown, no explanation:

{
  "title": "string",
  "description": "string",
  "servings": 4,
  "prep_time_minutes": 10,
  "cook_time_minutes": 20,
  "instructions": "Step 1: ...\\nStep 2: ...",
  "ingredients": [
    { "name": "string", "quantity": 1.5, "unit": "cup", "notes": "optional" }
  ],
  "tags": ["string"]
}`

const PARSE_PREAMBLE = `The following text is from a recipe webpage or document. It may contain navigation menus, ads, newsletter signups, FAQ sections, related recipes, reader comments, and other non-recipe content.

Extract ONLY the actual recipe:
- title, description, servings, prep time, cook time
- the ingredient list with precise quantities and units
- numbered cooking steps (not FAQ answers, tips articles, or timeline guides)

Ignore menus, ads, FAQs, reader comments, and any text that is not part of the core recipe.

RECIPE TEXT:
`

// ─── Glassmorphism card ──────────────────────────────────────────────────────

function GlassCard({ children, sx = {} }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        backdropFilter: 'blur(24px) saturate(180%)',
        bgcolor: theme.palette.mode === 'dark'
          ? alpha('#1c1c1e', 0.75)
          : alpha('#ffffff', 0.82),
        border: '1px solid',
        borderColor: theme.palette.mode === 'dark'
          ? alpha('#ffffff', 0.1)
          : alpha('#000000', 0.06),
        borderRadius: 4,
        boxShadow: theme.palette.mode === 'dark'
          ? '0 8px 40px rgba(0,0,0,0.45)'
          : '0 4px 24px rgba(0,0,0,0.07)',
        p: 3,
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

// ─── Mode selector ───────────────────────────────────────────────────────────

const MODES = [
  { id: 'generate', label: 'Generate', icon: <AutoAwesomeIcon sx={{ fontSize: 15 }} /> },
  { id: 'url', label: 'Import URL', icon: <LinkIcon sx={{ fontSize: 15 }} /> },
  { id: 'paste', label: 'Paste Text', icon: <ContentPasteIcon sx={{ fontSize: 15 }} /> },
  { id: 'json', label: 'Paste JSON', icon: <ContentCopyIcon sx={{ fontSize: 15 }} /> },
]

function ModePill({ modes, value, onChange }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        display: 'inline-flex',
        gap: 0.5,
        p: 0.5,
        borderRadius: 99,
        bgcolor: theme.palette.mode === 'dark'
          ? alpha('#ffffff', 0.06)
          : alpha('#000000', 0.05),
        border: '1px solid',
        borderColor: theme.palette.mode === 'dark'
          ? alpha('#ffffff', 0.08)
          : alpha('#000000', 0.06),
      }}
    >
      {modes.map((m) => {
        const active = m.id === value
        return (
          <Box
            key={m.id}
            onClick={() => onChange(m.id)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.75,
              py: 0.75,
              borderRadius: 99,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              transition: 'all 0.18s ease',
              bgcolor: active
                ? theme.palette.mode === 'dark' ? alpha('#ffffff', 0.12) : '#ffffff'
                : 'transparent',
              color: active ? 'text.primary' : 'text.secondary',
              boxShadow: active
                ? theme.palette.mode === 'dark'
                  ? '0 1px 6px rgba(0,0,0,0.4)'
                  : '0 1px 6px rgba(0,0,0,0.1)'
                : 'none',
              '&:hover': {
                bgcolor: active
                  ? undefined
                  : theme.palette.mode === 'dark' ? alpha('#ffffff', 0.06) : alpha('#000000', 0.04),
              },
            }}
          >
            {m.icon}
            {m.label}
          </Box>
        )
      })}
    </Box>
  )
}

// ─── Recipe result card ──────────────────────────────────────────────────────

function RecipeResult({ generated, onSave, saving, saved }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        mt: 3,
        borderRadius: 4,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: theme.palette.mode === 'dark'
          ? '0 8px 40px rgba(0,0,0,0.35)'
          : '0 4px 24px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header band */}
      <Box
        sx={{
          px: 3,
          py: 2.5,
          background: theme.palette.mode === 'dark'
            ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.4)}, ${alpha('#1c1c2e', 0.6)})`
            : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.15)}, ${alpha(theme.palette.primary.main, 0.05)})`,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
            {generated.title}
          </Typography>
          {generated.description && (
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600 }}>
              {generated.description}
            </Typography>
          )}
        </Box>
        {saved ? (
          <Alert severity="success" sx={{ py: 0 }}>Saved! Redirecting…</Alert>
        ) : (
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={onSave}
            disabled={saving}
            sx={{ borderRadius: 99, px: 2.5, flexShrink: 0 }}
          >
            {saving ? 'Saving…' : 'Save to Cookbook'}
          </Button>
        )}
      </Box>

      {/* Meta chips */}
      <Box sx={{ px: 3, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          {generated.prep_time_minutes > 0 && (
            <Chip icon={<AccessTimeIcon />} label={`Prep ${generated.prep_time_minutes}m`} size="small" variant="outlined" />
          )}
          {generated.cook_time_minutes > 0 && (
            <Chip icon={<AccessTimeIcon />} label={`Cook ${generated.cook_time_minutes}m`} size="small" variant="outlined" />
          )}
          {generated.servings > 0 && (
            <Chip icon={<PeopleIcon />} label={`${generated.servings} servings`} size="small" variant="outlined" />
          )}
          {generated.tags?.map((tag) => {
            const name = typeof tag === 'object' ? tag.name : tag
            return <Chip key={name} label={name} size="small" color="primary" variant="outlined" />
          })}
        </Stack>
      </Box>

      {/* Body */}
      <Box sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10, letterSpacing: '0.1em' }}>
              Ingredients
            </Typography>
            <List dense disablePadding sx={{ mt: 0.5 }}>
              {(generated.ingredients || []).map((ing, i) => {
                const name =
                  typeof ing.ingredient === 'object'
                    ? ing.ingredient?.name
                    : ing.ingredient_name || ing.name || ing.ingredient || ''
                return (
                  <ListItem key={i} disableGutters sx={{ py: 0.3 }}>
                    <ListItemText
                      primary={
                        <Typography variant="body2">
                          {ing.quantity ? <strong>{ing.quantity}{ing.unit ? ` ${ing.unit}` : ''}</strong> : null}
                          {ing.quantity ? ' ' : ''}
                          {name}
                          {ing.notes ? (
                            <Typography component="span" variant="caption" color="text.disabled">
                              {' — '}{ing.notes}
                            </Typography>
                          ) : null}
                        </Typography>
                      }
                    />
                  </ListItem>
                )
              })}
            </List>
          </Grid>

          <Grid item xs={12} md={8}>
            <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10, letterSpacing: '0.1em' }}>
              Instructions
            </Typography>
            <Box
              sx={{
                mt: 0.5,
                p: 2,
                borderRadius: 3,
                bgcolor: theme.palette.mode === 'dark' ? alpha('#ffffff', 0.03) : alpha('#000000', 0.02),
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.9 }}>
                {generated.instructions}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClaudeGenerator() {
  const [mode, setMode] = useState('generate')
  const [providerConfig] = useProviderConfig()
  const webLLM = useWebLLM()
  const { user } = useAuth()
  const theme = useTheme()
  const navigate = useNavigate()

  const isBrowser = providerConfig.provider === 'browser'

  // Generate mode
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(null)

  // URL mode
  const [urlInput, setUrlInput] = useState('')
  const [urlFetching, setUrlFetching] = useState(false)
  const [urlParsing, setUrlParsing] = useState(false)
  const [urlRecipe, setUrlRecipe] = useState(null)
  const [urlStructured, setUrlStructured] = useState(null)
  const [parseText, setParseText] = useState('')
  const [urlError, setUrlError] = useState(null)

  // Paste Text mode
  const [pasteRawText, setPasteRawText] = useState('')
  const [textParsing, setTextParsing] = useState(false)
  const [textRecipe, setTextRecipe] = useState(null)
  const [textError, setTextError] = useState(null)

  // Paste JSON mode
  const [jsonText, setJsonText] = useState('')
  const [jsonRecipe, setJsonRecipe] = useState(null)
  const [jsonError, setJsonError] = useState(null)
  const [copied, setCopied] = useState(false)

  // Shared
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  // ── Persistence: restore state when navigating back to this page ────────────
  useEffect(() => {
    const s = recipeGenStore.get()
    if (s.mode !== 'generate') setMode(s.mode)
    if (s.prompt) setPrompt(s.prompt)
    if (s.generated) setGenerated(s.generated)
    if (s.urlInput) setUrlInput(s.urlInput)
    if (s.urlRecipe) setUrlRecipe(s.urlRecipe)
    if (s.urlStructured) setUrlStructured(s.urlStructured)
    if (s.parseText) setParseText(s.parseText)
    if (s.pasteRawText) setPasteRawText(s.pasteRawText)
    if (s.textRecipe) setTextRecipe(s.textRecipe)
    if (s.jsonText) setJsonText(s.jsonText)
    if (s.jsonRecipe) setJsonRecipe(s.jsonRecipe)
    if (s.generating) setGenerating(true)
    if (s.error) setError(s.error)
  }, [])

  // Pick up results that finished while we were on another page
  useEffect(() => {
    return recipeGenStore.subscribe((s) => {
      setGenerating(s.generating)
      if (s.generated !== null) setGenerated(s.generated)
      if (s.error !== null) setError(s.error)
      if (s.urlRecipe !== null) setUrlRecipe(s.urlRecipe)
      if (s.textRecipe !== null) setTextRecipe(s.textRecipe)
    })
  }, [])

  // Keep input state in sync with store so it survives navigation
  useEffect(() => {
    recipeGenStore.set({ mode, prompt, urlInput, pasteRawText, jsonText })
  }, [mode, prompt, urlInput, pasteRawText, jsonText])

  const saveSource =
    isBrowser ? 'browser' :
    providerConfig.provider === 'claude' ? 'claude' :
    providerConfig.provider === 'ollama' ? 'ollama' : 'openai_compat'

  const providerLabel =
    isBrowser
      ? `Browser — ${BROWSER_MODELS.find((m) => m.id === providerConfig.model)?.label?.split(' — ')[0] || 'no model'}${webLLM.status === 'ready' ? '' : ' (not loaded)'}`
      : providerConfig.provider === 'claude' ? 'Claude'
      : providerConfig.provider === 'ollama' ? `Ollama — ${providerConfig.model || '?'}`
      : `OpenAI-compat — ${providerConfig.model || '?'}`

  const defaultModelId = providerConfig.model || BROWSER_MODELS[0].id

  const saveModelName =
    isBrowser
      ? (BROWSER_MODELS.find((m) => m.id === providerConfig.model)?.label?.split(' — ')[0] || providerConfig.model || '')
      : providerConfig.provider === 'claude'
        ? ''
        : providerConfig.model || ''

  const withInstructions = (text) => {
    const instr = user?.ai_instructions?.trim()
    return instr ? `${text}\n\nDietary & personal instructions (always follow these): ${instr}` : text
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSave = async (recipe, source) => {
    setSaving(true)
    setError(null)
    try {
      const res = await saveGeneratedRecipe({ ...recipe, source: source || saveSource, model_name: saveModelName })
      setSaved(true)
      recipeGenStore.reset()
      setTimeout(() => navigate(`/cookbook/${res.data.id}`), 1200)
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    setError(null)
    setGenerated(null)
    setSaved(false)
    recipeGenStore.set({ generating: true, error: null, generated: null, prompt: prompt.trim() })
    try {
      let recipe
      if (isBrowser) {
        await webLLM.ensureModelLoaded(defaultModelId)
        const content = await webLLM.generate([
          { role: 'system', content: BROWSER_SYSTEM_PROMPT },
          { role: 'user', content: withInstructions(prompt.trim()) },
        ])
        recipe = tryParseJson(content)
        if (!recipe) throw new Error('Model returned invalid JSON. Try rephrasing or switch to the 3B model in AI Provider Settings.')
      } else {
        const res = await generateRecipe(withInstructions(prompt.trim()), providerConfig)
        recipe = res.data
      }
      setGenerated(recipe)
      recipeGenStore.set({ generated: recipe, generating: false })
    } catch (err) {
      const errObj = err.response ? err : { message: err.message || 'Generation failed.' }
      setError(errObj)
      recipeGenStore.set({ error: errObj, generating: false })
    } finally {
      setGenerating(false)
    }
  }

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return
    setUrlFetching(true)
    setUrlError(null)
    setUrlStructured(null)
    setUrlRecipe(null)
    setParseText('')
    try {
      const res = await fetchRecipeUrl(urlInput.trim())
      if (res.data.structured) {
        setUrlStructured(res.data.structured)
      } else {
        const text = res.data.text || ''
        if (!text.trim()) {
          setUrlError('Could not extract text from this page. The site may require login or heavy JS rendering.')
        } else {
          setParseText(text)
        }
      }
    } catch (err) {
      setUrlError(err.response?.data?.detail || 'Could not fetch that URL.')
    } finally {
      setUrlFetching(false)
    }
  }

  const runParseAI = async (text, setRecipeFn, setErrorFn, setLoadingFn, storeRecipeKey, storeErrorKey, storeLoadingKey) => {
    setLoadingFn(true)
    setErrorFn(null)
    setRecipeFn(null)
    setSaved(false)
    if (storeLoadingKey) recipeGenStore.set({ [storeLoadingKey]: true, [storeErrorKey]: null, [storeRecipeKey]: null })
    const maxChars = isBrowser ? BROWSER_MAX_PARSE_CHARS : MAX_PARSE_CHARS
    const truncated = text.slice(0, maxChars)
    const parsePrompt = withInstructions(PARSE_PREAMBLE + truncated + (text.length > maxChars ? '\n\n[TEXT TRUNCATED]' : ''))
    try {
      if (isBrowser) {
        await webLLM.ensureModelLoaded(defaultModelId)
        const content = await webLLM.generate(
          [{ role: 'system', content: BROWSER_SYSTEM_PROMPT }, { role: 'user', content: parsePrompt }],
          { max_tokens: 2048 },
        )
        const recipe = tryParseJson(content)
        if (!recipe) throw new Error('Model returned invalid JSON. Try pasting just the ingredient list and steps.')
        setRecipeFn(recipe)
        if (storeRecipeKey) recipeGenStore.set({ [storeRecipeKey]: recipe })
      } else {
        const res = await generateRecipe(parsePrompt, providerConfig)
        setRecipeFn(res.data)
        if (storeRecipeKey) recipeGenStore.set({ [storeRecipeKey]: res.data })
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Could not parse recipe.'
      setErrorFn(msg)
      if (storeErrorKey) recipeGenStore.set({ [storeErrorKey]: msg })
    } finally {
      setLoadingFn(false)
      if (storeLoadingKey) recipeGenStore.set({ [storeLoadingKey]: false })
    }
  }

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(JSON_PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePasteJson = () => {
    setJsonError(null)
    setJsonRecipe(null)
    setSaved(false)
    try {
      const data = JSON.parse(jsonText.trim())
      if (!data.title || !data.ingredients || !data.instructions) {
        setJsonError('Missing required fields: title, ingredients, or instructions.')
        return
      }
      setJsonRecipe(data)
    } catch {
      setJsonError('Could not parse JSON. Make sure you pasted the full JSON response from Claude.')
    }
  }

  // ── UI ───────────────────────────────────────────────────────────────────────

  // Subtle mesh gradient background for the page
  const pageBg = theme.palette.mode === 'dark'
    ? `radial-gradient(ellipse 80% 50% at 20% 0%, ${alpha(theme.palette.primary.dark, 0.12)} 0%, transparent 60%),
       radial-gradient(ellipse 60% 40% at 80% 100%, ${alpha('#7c3aed', 0.08)} 0%, transparent 60%)`
    : `radial-gradient(ellipse 80% 50% at 20% 0%, ${alpha(theme.palette.primary.light, 0.18)} 0%, transparent 60%),
       radial-gradient(ellipse 60% 40% at 80% 100%, ${alpha('#7c3aed', 0.06)} 0%, transparent 60%)`

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto', background: pageBg, minHeight: '80vh', borderRadius: 5, p: { xs: 2, sm: 3 } }}>
      {/* ── Header ── */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography
          variant="h3"
          fontWeight={800}
          sx={{
            letterSpacing: '-0.02em',
            background: theme.palette.mode === 'dark'
              ? `linear-gradient(135deg, #ffffff 30%, ${alpha(theme.palette.primary.light, 0.8)})`
              : `linear-gradient(135deg, #1a1a2e 30%, ${theme.palette.primary.main})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            mb: 0.5,
          }}
        >
          AI Recipe Generator
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Create, import, or convert recipes with your configured AI provider
        </Typography>
      </Box>

      <ErrorAlert error={error} onClose={() => setError(null)} />

      {/* ── Mode selector ── */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <ModePill modes={MODES} value={mode} onChange={(m) => { setMode(m); setSaved(false) }} />
      </Box>

      {/* ── Provider badge ── */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <Chip
          icon={<SmartToyIcon />}
          label={providerLabel}
          size="small"
          variant="outlined"
          color={isBrowser && webLLM.status === 'loading' ? 'warning' : isBrowser ? 'success' : 'primary'}
          sx={{ fontSize: 12 }}
        />
      </Box>

      {/* ── Browser loading hint ── */}
      {isBrowser && webLLM.status === 'idle' && mode !== 'json' && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 3 }}>
          Browser AI is selected but not loaded — clicking Generate will download it automatically.
        </Alert>
      )}

      {/* ════ Generate mode ════ */}
      {mode === 'generate' && (
        <>
          <GlassCard>
            <TextField
              value={prompt}
              onChange={(e) => { if (e.target.value.length <= MAX_CHARS) setPrompt(e.target.value) }}
              fullWidth
              multiline
              rows={4}
              placeholder="e.g. A healthy Mediterranean chicken dish with lemon, olives, and herbs. Serves 4, ready in under 45 minutes."
              disabled={generating}
              variant="standard"
              InputProps={{ disableUnderline: true, sx: { fontSize: 15 } }}
              helperText={`${prompt.length} / ${MAX_CHARS}`}
              FormHelperTextProps={{ sx: { textAlign: 'right', opacity: 0.5 } }}
            />
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<AutoAwesomeIcon />}
                onClick={handleGenerate}
                disabled={!prompt.trim() || generating}
                size="large"
                sx={{ borderRadius: 99, px: 3, fontWeight: 600 }}
              >
                {generating ? 'Generating…' : 'Generate Recipe'}
              </Button>
            </Box>
            {generating && <LinearProgress sx={{ mt: 2, borderRadius: 99 }} />}
          </GlassCard>

          {generated && (
            <RecipeResult
              generated={generated}
              onSave={() => handleSave(generated)}
              saving={saving}
              saved={saved}
            />
          )}
        </>
      )}

      {/* ════ Import URL mode ════ */}
      {mode === 'url' && (
        <>
          <GlassCard>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
              <TextField
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                fullWidth
                placeholder="https://www.simplyrecipes.com/recipes/..."
                label="Recipe URL"
                size="small"
                disabled={urlFetching || urlParsing}
                onKeyDown={(e) => { if (e.key === 'Enter') handleFetchUrl() }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 99 } }}
              />
              <Button
                variant="contained"
                onClick={handleFetchUrl}
                disabled={!urlInput.trim() || urlFetching || urlParsing}
                sx={{ borderRadius: 99, whiteSpace: 'nowrap', px: 2.5 }}
              >
                {urlFetching ? 'Fetching…' : 'Fetch'}
              </Button>
            </Stack>

            <Typography variant="caption" color="text.secondary">
              Most major recipe sites (AllRecipes, SimplyRecipes, etc.) are parsed automatically. Others are sent to AI.
            </Typography>

            {urlError && (
              <Alert severity="error" sx={{ mt: 2, borderRadius: 3 }} onClose={() => setUrlError(null)}>
                {urlError}
              </Alert>
            )}

            {!urlStructured && parseText && (
              <Box sx={{ mt: 2 }}>
                <TextField
                  value={parseText}
                  onChange={(e) => { setParseText(e.target.value); setUrlRecipe(null) }}
                  fullWidth
                  multiline
                  rows={6}
                  placeholder="Fetched text appears here…"
                  disabled={urlParsing}
                  helperText={`${parseText.length} chars${parseText.length > MAX_PARSE_CHARS ? ` — will be trimmed to ${isBrowser ? BROWSER_MAX_PARSE_CHARS : MAX_PARSE_CHARS}` : ''}`}
                />
                {urlParsing && <LinearProgress sx={{ mt: 1, borderRadius: 99 }} />}
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={<AutoAwesomeIcon />}
                    onClick={() => runParseAI(parseText, setUrlRecipe, setUrlError, setUrlParsing, 'urlRecipe', 'urlError', 'urlParsing')}
                                    disabled={urlParsing}
                    sx={{ borderRadius: 99, px: 3 }}
                  >
                    {urlParsing ? 'Parsing…' : 'Parse with AI'}
                  </Button>
                </Box>
              </Box>
            )}

            {urlStructured && (
              <Alert
                severity="success"
                sx={{ mt: 2, borderRadius: 3 }}
                action={
                  <Button size="small" color="inherit" onClick={() => { setUrlStructured(null); setParseText('') }}>
                    Use AI instead
                  </Button>
                }
              >
                Structured recipe data found — no AI needed!
              </Alert>
            )}
          </GlassCard>

          {urlStructured && (
            <RecipeResult generated={urlStructured} onSave={() => handleSave(urlStructured, 'url')} saving={saving} saved={saved} />
          )}
          {urlRecipe && !urlStructured && (
            <RecipeResult generated={urlRecipe} onSave={() => handleSave(urlRecipe)} saving={saving} saved={saved} />
          )}
        </>
      )}

      {/* ════ Paste Text mode ════ */}
      {mode === 'paste' && (
        <>
          <GlassCard>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Paste any messy recipe text — a webpage dump, a screenshot OCR, a blog post. AI will extract just the title, ingredients, and steps.
            </Typography>
            <TextField
              value={pasteRawText}
              onChange={(e) => { setPasteRawText(e.target.value); setTextRecipe(null) }}
              fullWidth
              multiline
              rows={8}
              placeholder="Paste recipe text here…"
              disabled={textParsing}
              helperText={pasteRawText.length > 0 ? `${pasteRawText.length} characters` : undefined}
            />
            {textError && (
              <Alert severity="error" sx={{ mt: 2, borderRadius: 3 }} onClose={() => setTextError(null)}>
                {textError}
              </Alert>
            )}
            {textParsing && <LinearProgress sx={{ mt: 2, borderRadius: 99 }} />}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<AutoAwesomeIcon />}
                onClick={() => runParseAI(pasteRawText, setTextRecipe, setTextError, setTextParsing, 'textRecipe', 'textError', 'textParsing')}
                disabled={!pasteRawText.trim() || textParsing}
                sx={{ borderRadius: 99, px: 3 }}
              >
                {textParsing ? 'Parsing…' : 'Parse with AI'}
              </Button>
            </Box>
          </GlassCard>

          {textRecipe && (
            <RecipeResult generated={textRecipe} onSave={() => handleSave(textRecipe)} saving={saving} saved={saved} />
          )}
        </>
      )}

      {/* ════ Paste JSON mode ════ */}
      {mode === 'json' && (
        <>
          <GlassCard>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Copy this prompt into{' '}
              <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                claude.ai
              </a>
              {' '}followed by your recipe request, then paste the JSON response below.
            </Typography>

            <Box
              sx={{
                position: 'relative',
                p: 1.5,
                mb: 2,
                borderRadius: 3,
                bgcolor: theme.palette.mode === 'dark' ? alpha('#ffffff', 0.04) : alpha('#000000', 0.03),
                border: '1px solid',
                borderColor: 'divider',
                fontFamily: 'monospace',
                fontSize: 12,
              }}
            >
              <Tooltip title={copied ? 'Copied!' : 'Copy prompt'}>
                <IconButton size="small" onClick={handleCopyPrompt} sx={{ position: 'absolute', top: 8, right: 8 }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', pr: 4, color: 'text.secondary' }}>
                {JSON_PROMPT}
              </Box>
            </Box>

            {jsonError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 3 }} onClose={() => setJsonError(null)}>
                {jsonError}
              </Alert>
            )}

            <TextField
              value={jsonText}
              onChange={(e) => { setJsonText(e.target.value); setJsonRecipe(null) }}
              fullWidth
              multiline
              rows={7}
              placeholder={'{\n  "title": "...",\n  "ingredients": [...],\n  ...\n}'}
              sx={{ fontFamily: 'monospace', fontSize: 13 }}
            />
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={handlePasteJson}
                disabled={!jsonText.trim()}
                sx={{ borderRadius: 99, px: 3 }}
              >
                Preview Recipe
              </Button>
            </Box>
          </GlassCard>

          {jsonRecipe && (
            <RecipeResult generated={jsonRecipe} onSave={() => handleSave(jsonRecipe)} saving={saving} saved={saved} />
          )}
        </>
      )}
    </Box>
  )
}
