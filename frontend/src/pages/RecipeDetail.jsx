import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  Chip,
  Stack,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Paper,
  TextField,
  Alert,
  LinearProgress,
} from '@mui/material'
import CircularProgress from '@mui/material/CircularProgress'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PeopleIcon from '@mui/icons-material/People'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { getRecipe, deleteRecipe, fillRecipeMacros, remixRecipe, saveGeneratedRecipe } from '../api/recipes'
import { addEntry } from '../api/mealPlans'
import SourceBadge from '../components/recipes/SourceBadge'
import PortionScaler from '../components/recipes/PortionScaler'
import AddToPlanModal from '../components/meal_planner/AddToPlanModal'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorAlert from '../components/common/ErrorAlert'
import { scaleQuantity, parseInstructionSegments } from '../utils/portionMath'
import { getMonday, formatWeekStart, getWeekDays } from '../utils/weekUtils'
import useAuth from '../hooks/useAuth'

function parseSteps(instructions) {
  if (!instructions) return []
  return instructions
    .split('\n')
    .map((s) => s.replace(/^Step\s*\d+:\s*/i, '').trim())
    .filter(Boolean)
}

export default function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [targetServings, setTargetServings] = useState(1)
  const [addToPlanOpen, setAddToPlanOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [checkedSteps, setCheckedSteps] = useState(new Set())
  const [macrosFilling, setMacrosFilling] = useState(false)

  // AI Remix
  const [remixOpen, setRemixOpen] = useState(false)
  const [remixInstruction, setRemixInstruction] = useState('')
  const [remixLoading, setRemixLoading] = useState(false)
  const [remixResult, setRemixResult] = useState(null)
  const [remixError, setRemixError] = useState(null)
  const [remixSaving, setRemixSaving] = useState(false)

  const toggleStep = (i) => setCheckedSteps((prev) => {
    const next = new Set(prev)
    next.has(i) ? next.delete(i) : next.add(i)
    return next
  })

  const weekStart = formatWeekStart(getMonday(new Date()))
  const weekDays = getWeekDays(weekStart).map(formatWeekStart)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await getRecipe(id)
        setRecipe(res.data)
        setTargetServings(res.data.servings || 1)
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handleDelete = async () => {
    setDeleteLoading(true)
    try {
      await deleteRecipe(id)
      navigate('/cookbook')
    } catch (err) {
      setError(err)
    } finally {
      setDeleteLoading(false)
      setDeleteDialogOpen(false)
    }
  }

  const handleAddToPlan = async (data) => {
    await addEntry(weekStart, data)
  }

  const handleRemix = async () => {
    if (!remixInstruction.trim()) return
    setRemixLoading(true)
    setRemixError(null)
    setRemixResult(null)
    try {
      let providerConfig = {}
      try {
        const raw = localStorage.getItem('recipeAiProviderConfig')
        if (raw) providerConfig = JSON.parse(raw)
      } catch { /* ignore */ }
      const res = await remixRecipe(id, remixInstruction.trim(), providerConfig)
      setRemixResult(res.data)
    } catch (err) {
      setRemixError(err.response?.data?.detail || err.message || 'AI remix failed.')
    } finally {
      setRemixLoading(false)
    }
  }

  const handleSaveRemixAsNew = async () => {
    if (!remixResult) return
    setRemixSaving(true)
    try {
      let providerConfig = {}
      try {
        const raw = localStorage.getItem('recipeAiProviderConfig')
        if (raw) providerConfig = JSON.parse(raw)
      } catch { /* ignore */ }
      const source = providerConfig.provider === 'claude' ? 'claude'
        : providerConfig.provider === 'ollama' ? 'ollama' : 'openai_compat'
      const res = await saveGeneratedRecipe({ ...remixResult, source })
      navigate(`/cookbook/${res.data.id}`)
    } catch (err) {
      setRemixError(err.response?.data?.detail || 'Failed to save recipe.')
    } finally {
      setRemixSaving(false)
    }
  }

  const handleFillMacros = async () => {
    setMacrosFilling(true)
    setError(null)
    try {
      let providerConfig = {}
      try {
        const raw = localStorage.getItem('recipeAiProviderConfig')
        if (raw) providerConfig = JSON.parse(raw)
      } catch { /* ignore */ }
      const res = await fillRecipeMacros(id, providerConfig)
      setRecipe(res.data)
    } catch (err) {
      setError(err)
    } finally {
      setMacrosFilling(false)
    }
  }

  if (loading) return <LoadingSpinner />

  if (error && !recipe) {
    return (
      <Box>
        <ErrorAlert error={error} />
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/cookbook')}>
          Back to Cookbook
        </Button>
      </Box>
    )
  }

  if (!recipe) return null

  // API returns recipe_ingredients (read) and tag_details (read)
  const ingredients = recipe.recipe_ingredients || []
  const tags = recipe.tag_details || []
  const steps = parseSteps(recipe.instructions)
  const isOwner = recipe.user_id === user?.id

  return (
    <Box maxWidth={860} mx="auto">
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/cookbook')} sx={{ mb: 2 }}>
        Back to Cookbook
      </Button>

      <ErrorAlert error={error} onClose={() => setError(null)} />

      {/* ── Header ── */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h4" fontWeight={700} sx={{ flexGrow: 1 }}>
            {recipe.title}
          </Typography>
          {isOwner && (
            <Stack direction="row" spacing={1}>
              <IconButton onClick={() => navigate(`/cookbook/${id}/edit`)} color="primary">
                <EditIcon />
              </IconButton>
              <IconButton onClick={() => setDeleteDialogOpen(true)} color="error">
                <DeleteIcon />
              </IconButton>
            </Stack>
          )}
        </Box>

        {recipe.description && (
          <Typography variant="body1" color="text.secondary" mt={1}>
            {recipe.description}
          </Typography>
        )}

        {/* Meta chips */}
        <Stack direction="row" flexWrap="wrap" gap={1} mt={2} alignItems="center">
          <SourceBadge source={recipe.source} />
          {recipe.prep_time_minutes > 0 && (
            <Chip icon={<AccessTimeIcon />} label={`Prep: ${recipe.prep_time_minutes} min`} size="small" variant="outlined" />
          )}
          {recipe.cook_time_minutes > 0 && (
            <Chip icon={<AccessTimeIcon />} label={`Cook: ${recipe.cook_time_minutes} min`} size="small" variant="outlined" />
          )}
          {tags.map((tag) => (
            <Chip key={tag.id} label={tag.name} size="small" color="primary" variant="outlined" />
          ))}
        </Stack>

        {/* Portion scaler + Add to plan + AI Remix */}
        <Stack direction="row" gap={1} mt={2} flexWrap="wrap" alignItems="center">
          <PortionScaler
            baseServings={recipe.servings || 1}
            targetServings={targetServings}
            onChange={setTargetServings}
          />
          <Button variant="contained" startIcon={<CalendarMonthIcon />} onClick={() => setAddToPlanOpen(true)}>
            Add to Meal Plan
          </Button>
          <Button
            variant="outlined"
            startIcon={<AutoFixHighIcon />}
            onClick={() => { setRemixOpen(true); setRemixResult(null); setRemixError(null); setRemixInstruction('') }}
          >
            AI Remix
          </Button>
        </Stack>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* ── Macros ── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <LocalFireDepartmentIcon color="error" fontSize="small" />
          <Typography variant="subtitle2" fontWeight={600}>Nutrition</Typography>
          {recipe.macros_per_serving && !recipe.macros_per_serving.complete && recipe.macros_per_serving.total_ingredients > 0 && (
            <Typography variant="caption" color="text.secondary">
              · estimate ({recipe.macros_per_serving.tracked_ingredients}/{recipe.macros_per_serving.total_ingredients} ingredients tracked)
            </Typography>
          )}
          <Box sx={{ ml: 'auto' }}>
            <Button
              size="small"
              startIcon={macrosFilling ? <CircularProgress size={14} /> : <LocalFireDepartmentIcon />}
              onClick={handleFillMacros}
              disabled={macrosFilling}
              variant="outlined"
            >
              {macrosFilling ? 'Estimating…' : 'Fill with AI'}
            </Button>
          </Box>
        </Box>
        {recipe.macros_per_serving && recipe.macros_per_serving.total_ingredients > 0 ? (() => {
          const MACROS = [
            { label: 'Calories', key: 'calories',  unit: 'kcal', color: 'error.main' },
            { label: 'Protein',  key: 'protein_g', unit: 'g',    color: 'primary.main' },
            { label: 'Carbs',    key: 'carbs_g',   unit: 'g',    color: 'warning.main' },
            { label: 'Fat',      key: 'fat_g',     unit: 'g',    color: 'text.secondary' },
          ]
          const MacroRow = ({ values, rowLabel }) => (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {rowLabel}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={2}>
                {MACROS.map(({ label, key, unit, color }) => (
                  <Box key={label} sx={{ textAlign: 'center', minWidth: 64 }}>
                    <Typography variant="h6" fontWeight={700} color={color}>
                      {Math.round(values[key] * 10) / 10}
                      <Typography component="span" variant="caption" color="text.secondary"> {unit}</Typography>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )
          const perServing = recipe.macros_per_serving
          const total = Object.fromEntries(
            Object.entries(perServing).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * targetServings * 10) / 10 : v])
          )
          return (
            <Stack gap={2}>
              <MacroRow values={perServing} rowLabel="Per serving" />
              {targetServings > 1 && (
                <MacroRow values={total} rowLabel={`Total · ${targetServings} servings`} />
              )}
            </Stack>
          )
        })() : (
          <Typography variant="body2" color="text.secondary">
            No nutrition data yet. Click "Fill with AI" to estimate macros.
          </Typography>
        )}
      </Paper>

      <Grid container spacing={4}>
        {/* ── Ingredients ── */}
        <Grid item xs={12} md={4}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Ingredients
            {targetServings !== recipe.servings && (
              <Chip
                label={`×${(targetServings / (recipe.servings || 1)).toFixed(2).replace(/\.?0+$/, '')}`}
                size="small"
                color="primary"
                sx={{ ml: 1, verticalAlign: 'middle' }}
              />
            )}
          </Typography>

          {ingredients.length > 0 ? (
            <List dense disablePadding>
              {ingredients.map((ing) => {
                const scaledQty = scaleQuantity(ing.quantity, recipe.servings || 1, targetServings)
                return (
                  <ListItem key={ing.id} disableGutters sx={{ py: 0.5, alignItems: 'flex-start' }}>
                    <ListItemIcon sx={{ minWidth: 16, mt: '6px' }}>
                      <FiberManualRecordIcon sx={{ fontSize: 6, color: 'primary.main' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2">
                          <strong>{scaledQty}{ing.unit ? ` ${ing.unit}` : ''}</strong>{' '}
                          {ing.ingredient_name}
                          {ing.notes ? (
                            <Typography component="span" variant="caption" color="text.secondary">
                              {' '}({ing.notes})
                            </Typography>
                          ) : null}
                        </Typography>
                      }
                    />
                  </ListItem>
                )
              })}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">No ingredients listed</Typography>
          )}
        </Grid>

        {/* ── Instructions ── */}
        <Grid item xs={12} md={8}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6" fontWeight={600}>
              Instructions
            </Typography>
            {checkedSteps.size > 0 && (
              <Button
                size="small"
                startIcon={<RestartAltIcon />}
                onClick={() => setCheckedSteps(new Set())}
              >
                Reset ({checkedSteps.size}/{steps.length})
              </Button>
            )}
          </Box>

          {steps.length > 0 ? (
            <List disablePadding>
              {steps.map((step, i) => {
                const done = checkedSteps.has(i)
                const segments = parseInstructionSegments(step, recipe.servings || 1, targetServings)
                return (
                  <ListItem
                    key={i}
                    disableGutters
                    alignItems="flex-start"
                    onClick={() => toggleStep(i)}
                    sx={{ pb: 2, cursor: 'pointer', opacity: done ? 0.45 : 1, transition: 'opacity 0.2s' }}
                  >
                    <ListItemIcon sx={{ minWidth: 36, mt: '2px' }}>
                      {done ? (
                        <CheckCircleIcon sx={{ fontSize: 24, color: 'success.main' }} />
                      ) : (
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {i + 1}
                        </Box>
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography
                          variant="body1"
                          sx={{ lineHeight: 1.7, textDecoration: done ? 'line-through' : 'none' }}
                        >
                          {segments.map((seg, j) =>
                            seg.scaled ? (
                              <Box
                                key={j}
                                component="mark"
                                title={`original: ${seg.original}`}
                                sx={{
                                  bgcolor: 'primary.main',
                                  color: 'primary.contrastText',
                                  borderRadius: '3px',
                                  px: '3px',
                                  fontWeight: 700,
                                }}
                              >
                                {seg.scaledText}
                              </Box>
                            ) : (
                              <span key={j}>{seg.text}</span>
                            )
                          )}
                        </Typography>
                      }
                    />
                  </ListItem>
                )
              })}
            </List>
          ) : (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                {recipe.instructions}
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      <AddToPlanModal
        open={addToPlanOpen}
        onClose={() => setAddToPlanOpen(false)}
        onAdd={handleAddToPlan}
        weekDays={weekDays}
      />

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Recipe</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete &ldquo;{recipe.title}&rdquo;? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleteLoading}>
            {deleteLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── AI Remix Dialog ── */}
      <Dialog open={remixOpen} onClose={() => !remixLoading && setRemixOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoFixHighIcon fontSize="small" />
          AI Remix
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Describe how you'd like to modify &ldquo;{recipe.title}&rdquo;. The AI will generate a new version — you can then save it as a separate recipe.
          </DialogContentText>

          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Modification instruction"
            placeholder="e.g. make it vegan, reduce calories, swap chicken for tofu, add more spice…"
            value={remixInstruction}
            onChange={(e) => setRemixInstruction(e.target.value)}
            disabled={remixLoading}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleRemix() }}
          />

          {remixLoading && <LinearProgress sx={{ mt: 2 }} />}

          {remixError && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setRemixError(null)}>
              {remixError}
            </Alert>
          )}

          {remixResult && (
            <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                {remixResult.title}
              </Typography>
              {remixResult.description && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {remixResult.description}
                </Typography>
              )}
              {remixResult.ingredients?.length > 0 && (
                <>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Ingredients
                  </Typography>
                  <List dense disablePadding sx={{ mt: 0.5, mb: 1 }}>
                    {remixResult.ingredients.slice(0, 6).map((ing, i) => (
                      <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                        <ListItemIcon sx={{ minWidth: 14, mr: 1 }}>
                          <FiberManualRecordIcon sx={{ fontSize: 6, color: 'primary.main' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="body2">
                              {ing.quantity ? `${ing.quantity}${ing.unit ? ` ${ing.unit}` : ''} ` : ''}{ing.name ?? ing.ingredient_name ?? ing.ingredient ?? ''}
                            </Typography>
                          }
                        />
                      </ListItem>
                    ))}
                    {remixResult.ingredients.length > 6 && (
                      <Typography variant="caption" color="text.secondary" sx={{ pl: 2.5 }}>
                        +{remixResult.ingredients.length - 6} more…
                      </Typography>
                    )}
                  </List>
                </>
              )}
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemixOpen(false)} disabled={remixLoading || remixSaving}>
            Cancel
          </Button>
          {remixResult ? (
            <>
              <Button
                startIcon={<ContentCopyIcon />}
                onClick={() => { setRemixResult(null); setRemixError(null) }}
                disabled={remixSaving}
              >
                Try Again
              </Button>
              <Button
                variant="contained"
                onClick={handleSaveRemixAsNew}
                disabled={remixSaving}
              >
                {remixSaving ? 'Saving…' : 'Save as New Recipe'}
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              startIcon={<AutoFixHighIcon />}
              onClick={handleRemix}
              disabled={remixLoading || !remixInstruction.trim()}
            >
              {remixLoading ? 'Remixing…' : 'Remix'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}
