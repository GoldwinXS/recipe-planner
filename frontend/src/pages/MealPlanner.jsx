import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  IconButton,
  Stack,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress,
  Alert,
  Chip,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { getMealPlan, addEntry, removeEntry, suggestMealPlan } from '../api/mealPlans'
import { mealPlanSuggestStore } from '../state/generationStore'
import { listRecipes } from '../api/recipes'
import { useWebLLM } from '../contexts/WebLLMContext'
import PlannerGrid from '../components/meal_planner/PlannerGrid'
import AddToPlanModal from '../components/meal_planner/AddToPlanModal'
import WeekOverview from '../components/meal_planner/WeekOverview'
import PrepGuide from '../components/meal_planner/PrepGuide'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorAlert from '../components/common/ErrorAlert'
import { getMonday, formatWeekStart, getWeekDays } from '../utils/weekUtils'
import { loadProviderConfig } from '../hooks/useProviderConfig'
import useAuth from '../hooks/useAuth'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function MealPlanner() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const webLLM = useWebLLM()
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    formatWeekStart(getMonday(new Date())),
  )
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [addModal, setAddModal] = useState({ open: false, day: null, mealType: null })

  // AI suggest state
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [planScope, setPlanScope] = useState('week') // 'week' | 'month'
  const [preferences, setPreferences] = useState(mealPlanSuggestStore.get().preferences || '')
  const [suggesting, setSuggesting] = useState(mealPlanSuggestStore.get().suggesting || false)
  const [suggestError, setSuggestError] = useState(mealPlanSuggestStore.get().suggestError || null)
  const [suggestDone, setSuggestDone] = useState(mealPlanSuggestStore.get().suggestDone || false)
  const [suggestStep, setSuggestStep] = useState(mealPlanSuggestStore.get().suggestStep || '')

  // If suggestion was in progress when we left, reopen the dialog and pick up state
  useEffect(() => {
    const s = mealPlanSuggestStore.get()
    if (s.suggesting || s.suggestDone) setSuggestOpen(true)
    return mealPlanSuggestStore.subscribe((s) => {
      setSuggesting(s.suggesting)
      setSuggestStep(s.suggestStep)
      setSuggestError(s.suggestError)
      setSuggestDone(s.suggestDone)
    })
  }, [])

  const weekDays = getWeekDays(currentWeekStart).map(formatWeekStart)

  const loadPlan = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getMealPlan(currentWeekStart)
      setEntries(res.data?.entries || [])
    } catch (err) {
      if (err.response?.status === 404) {
        setEntries([])
      } else {
        setError(err)
      }
    } finally {
      setLoading(false)
    }
  }, [currentWeekStart])

  useEffect(() => {
    loadPlan()
  }, [loadPlan])

  const handlePrevWeek = () => {
    const d = new Date(currentWeekStart + 'T00:00:00')
    d.setDate(d.getDate() - 7)
    setCurrentWeekStart(formatWeekStart(d))
  }

  const handleNextWeek = () => {
    const d = new Date(currentWeekStart + 'T00:00:00')
    d.setDate(d.getDate() + 7)
    setCurrentWeekStart(formatWeekStart(d))
  }

  const handleOpenAdd = (day, mealType) => {
    setAddModal({ open: true, day, mealType })
  }

  const handleAddEntry = async (data) => {
    await addEntry(currentWeekStart, data)
    await loadPlan()
  }

  const handleRemoveEntry = async (entryId) => {
    try {
      await removeEntry(currentWeekStart, entryId)
      setEntries((prev) => prev.filter((e) => e.id !== entryId))
    } catch (err) {
      setError(err)
    }
  }

  const step = (msg) => {
    setSuggestStep(msg)
    mealPlanSuggestStore.set({ suggestStep: msg })
  }

  // Returns the Monday date string for a given week offset from currentWeekStart
  const weekStartForOffset = useCallback((weekOffset) => {
    const d = new Date(currentWeekStart + 'T00:00:00')
    d.setDate(d.getDate() + weekOffset * 7)
    return formatWeekStart(d)
  }, [currentWeekStart])

  const handleSuggest = async () => {
    const isMonth = planScope === 'month'
    const days = isMonth ? 28 : 7
    const weeks = isMonth ? 4 : 1
    setSuggesting(true)
    setSuggestError(null)
    setSuggestDone(false)
    setSuggestStep('')
    mealPlanSuggestStore.set({ suggesting: true, suggestError: null, suggestDone: false, suggestStep: '' })
    try {
      const providerConfig = loadProviderConfig()
      const isBrowser = providerConfig.provider === 'browser'

      let suggestions = []

      const DAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      const cookingDays = user?.cooking_days?.length ? user.cooking_days : [6]
      const cookNames = cookingDays.map((d) => DAY_NAMES_FULL[d]).join(', ')

      const BROWSER_SYSTEM_PROMPT = `You are a nutritionist and meal planning expert. Suggest a meal plan that minimises food waste and flags meals needing freezing.

Return ONLY valid JSON — no preamble, no markdown:
{"suggestions":[{"week":0,"day":0,"meal_type":"breakfast","recipe_id":1,"storage":"fresh"},...]}

- week: 0–${weeks - 1}  |  day: 0 (Mon)–6 (Sun)  |  meal_type: breakfast/lunch/dinner/snack
- storage: "fresh"=same day, "fridge"=safe in fridge ≤4 days, "freeze"=must freeze (5+ days after cooking)
- 1 breakfast + 1 lunch + 1 dinner per day; vary recipes; avoid same recipe >2×/week
- Non-cooking days: use leftovers; freeze anything eaten 5+ days after cooking
Food safety: chicken/fish/beef fridge max 3–4 days; soups 4–5 days; grains 3–5 days`

      if (isBrowser) {
        if (webLLM.status !== 'ready') {
          const msg = 'Browser LLM is not loaded. Go to the AI settings (top bar) and load a model first.'
          setSuggestError(msg)
          mealPlanSuggestStore.set({ suggestError: msg, suggesting: false })
          return
        }

        step('Fetching your recipes…')
        const recipesRes = await listRecipes({ page_size: 200 })
        const allRecipes = recipesRes.data?.results || recipesRes.data || []
        if (allRecipes.length === 0) {
          const msg = 'You have no recipes. Add some recipes to your cookbook first.'
          setSuggestError(msg)
          mealPlanSuggestStore.set({ suggestError: msg, suggesting: false })
          return
        }

        const recipeLines = allRecipes.map((r) => {
          const m = r.macros_per_serving
          let line = `- ID ${r.id}: ${r.title}`
          if (r.tag_details?.length) line += ` [tags: ${r.tag_details.map((t) => t.name).join(', ')}]`
          if (m?.complete) {
            line += ` [~${Math.round(m.calories)} kcal, ${m.protein_g}g protein, ${m.carbs_g}g carbs, ${m.fat_g}g fat per serving]`
          }
          return line
        })

        const totalEntries = weeks * 7 * 3
        let userPrompt = `Plan ${weeks * 7} days (${totalEntries} total: 1 breakfast+lunch+dinner/day, week 0–${weeks - 1}) using ONLY these recipes:\n\n${recipeLines.join('\n')}`
        userPrompt += `\n\nCooking days each week: ${cookNames}. Non-cooking days use leftovers. Freeze anything eaten 5+ days after cooking.`

        if (user?.daily_calorie_goal || user?.daily_protein_g) {
          const goalParts = []
          if (user.daily_calorie_goal) goalParts.push(`${user.daily_calorie_goal} kcal`)
          if (user.daily_protein_g) goalParts.push(`${user.daily_protein_g}g protein`)
          if (user.daily_carbs_g) goalParts.push(`${user.daily_carbs_g}g carbs`)
          if (user.daily_fat_g) goalParts.push(`${user.daily_fat_g}g fat`)
          if (goalParts.length) userPrompt += `\n\nDaily macro targets: ${goalParts.join(', ')}`
        }

        if (preferences) userPrompt += `\n\nAdditional preferences: ${preferences}`

        step(`Asking browser AI to plan your ${isMonth ? 'month' : 'week'}…`)
        const content = await webLLM.generate([
          { role: 'system', content: BROWSER_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ])

        step('Parsing AI response…')
        const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
        let parsed
        try { parsed = JSON.parse(cleaned) } catch {
          const match = cleaned.match(/\{[\s\S]*\}/)
          if (match) {
            try { parsed = JSON.parse(match[0]) } catch { throw new Error('Browser LLM returned invalid JSON. Try again or use a different model.') }
          } else {
            throw new Error('Browser LLM returned invalid JSON. Try again or use a different model.')
          }
        }

        const validIds = new Set(allRecipes.map((r) => r.id))
        const validStorage = new Set(['fresh', 'fridge', 'freeze'])
        suggestions = (parsed.suggestions || [])
          .map((s) => ({ ...s, recipe_id: Number(s.recipe_id), week: Number(s.week ?? 0) }))
          .filter(
            (s) => s.recipe_id && validIds.has(s.recipe_id)
              && ['breakfast', 'lunch', 'dinner', 'snack'].includes(s.meal_type)
              && Number.isInteger(s.day) && s.day >= 0 && s.day < 7
              && Number.isInteger(s.week) && s.week >= 0 && s.week < weeks,
          )
          .map((s) => ({ ...s, storage: validStorage.has(s.storage) ? s.storage : 'fridge' }))

        if (suggestions.length === 0) {
          throw new Error(`AI returned ${parsed.suggestions?.length || 0} suggestions but none matched your recipe IDs. The model may be too small — try a larger one.`)
        }
      } else {
        step('Sending your recipes to AI…')
        const res = await suggestMealPlan(providerConfig, preferences, days)
        suggestions = res.data?.suggestions || []
      }

      if (suggestions.length === 0) {
        const msg = 'AI returned no suggestions. Try adding more recipes to your cookbook.'
        setSuggestError(msg)
        mealPlanSuggestStore.set({ suggestError: msg, suggesting: false })
        return
      }

      step(`Adding ${suggestions.length} meals to your ${isMonth ? 'month' : 'week'}…`)
      const results = await Promise.allSettled(
        suggestions.map((s) =>
          addEntry(weekStartForOffset(s.week ?? 0), {
            recipe: s.recipe_id,
            day: s.day,
            meal_type: s.meal_type,
            servings: 1,
            storage: s.storage || 'fridge',
          }),
        ),
      )
      const added = results.filter((r) => r.status === 'fulfilled').length
      await loadPlan()
      step(`Added ${added} meals ✓`)
      setSuggestDone(true)
      mealPlanSuggestStore.set({ suggestDone: true, suggesting: false })
      setTimeout(() => {
        setSuggestOpen(false)
        setSuggestDone(false)
        setSuggestStep('')
        setPreferences('')
        mealPlanSuggestStore.reset()
      }, 2000)
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to get suggestions.'
      setSuggestError(msg)
      setSuggestStep('')
      mealPlanSuggestStore.set({ suggestError: msg, suggestStep: '', suggesting: false })
    } finally {
      setSuggesting(false)
    }
  }

  const formatWeekRange = () => {
    const days = getWeekDays(currentWeekStart)
    const start = days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const end = days[6].toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    return `${start} – ${end}`
  }

  const isCurrentWeek = currentWeekStart === formatWeekStart(getMonday(new Date()))
  const isDemo = user?.email === 'demo@example.com'

  // If navigated from dashboard with ?day=N, auto-open that day's detail
  const initialOpenDay = searchParams.get('day') !== null ? parseInt(searchParams.get('day'), 10) : null

  return (
    <Box>
      {isDemo && (
        <Alert severity="info" sx={{ mb: 2 }} icon={false}>
          <strong>Demo account — read only.</strong> You can explore all features, but changes
          (adding/removing meals, editing recipes, etc.) won&apos;t be saved.
        </Alert>
      )}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Typography variant="h4" fontWeight={700}>
          Meal Planner
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<AutoAwesomeIcon />}
            onClick={() => setSuggestOpen(true)}
          >
            AI Suggest Week
          </Button>
          <Button
            variant="contained"
            startIcon={<ShoppingCartIcon />}
            onClick={() => navigate(`/shopping?week=${currentWeekStart}`)}
          >
            Shopping List
          </Button>
        </Stack>
      </Box>

      <ErrorAlert error={error} onClose={() => setError(null)} />

      {/* Week navigation */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: 'inline-flex', alignItems: 'center', gap: 1 }}>
        <IconButton size="small" onClick={handlePrevWeek}>
          <ChevronLeftIcon />
        </IconButton>
        <Box sx={{ textAlign: 'center', minWidth: 200 }}>
          <Typography variant="body1" fontWeight={600}>
            {formatWeekRange()}
          </Typography>
          {isCurrentWeek && (
            <Typography variant="caption" color="primary.main" fontWeight={500}>
              Current Week
            </Typography>
          )}
        </Box>
        <IconButton size="small" onClick={handleNextWeek}>
          <ChevronRightIcon />
        </IconButton>
        {!isCurrentWeek && (
          <Button
            size="small"
            onClick={() => setCurrentWeekStart(formatWeekStart(getMonday(new Date())))}
          >
            Today
          </Button>
        )}
      </Paper>

      {loading ? (
        <LoadingSpinner minHeight="40vh" />
      ) : (
        <>
          <PlannerGrid
            weekStart={currentWeekStart}
            entries={entries}
            onAdd={handleOpenAdd}
            onRemove={handleRemoveEntry}
          />
          <WeekOverview weekStart={currentWeekStart} entries={entries} initialOpenDay={initialOpenDay} />
          <PrepGuide weekStart={currentWeekStart} entries={entries} />
        </>
      )}

      <AddToPlanModal
        open={addModal.open}
        onClose={() => setAddModal({ open: false, day: null, mealType: null })}
        onAdd={handleAddEntry}
        defaultDay={addModal.day}
        defaultMealType={addModal.mealType}
        weekDays={weekDays}
      />

      {/* AI Suggest dialog */}
      <Dialog
        open={suggestOpen}
        onClose={() => !suggesting && setSuggestOpen(false)}
        maxWidth="sm"
        fullWidth
        BackdropProps={{ sx: { pointerEvents: suggesting ? 'none' : 'auto' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeIcon color="primary" />
          AI Suggest Plan
        </DialogTitle>
        <DialogContent>
          {suggestDone ? (
            <Alert severity="success">Plan filled with AI suggestions!</Alert>
          ) : (
            <>
              <ToggleButtonGroup
                value={planScope}
                exclusive
                onChange={(_, v) => v && setPlanScope(v)}
                size="small"
                disabled={suggesting}
                sx={{ mb: 2 }}
              >
                <ToggleButton value="week">This Week</ToggleButton>
                <ToggleButton value="month">This Month (4 weeks)</ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="body2" color="text.secondary" mb={2}>
                AI will suggest recipes from your cookbook
                {planScope === 'month' ? ' across the next 4 weeks' : " to fill this week's plan"}.
                Any existing entries will be kept. Meals that need freezing will be marked with ❄️.
              </Typography>

              {/* Show user's active settings */}
              {(() => {
                const cookingDays = user?.cooking_days?.length ? user.cooking_days : [6]
                const hasGoals = user?.daily_calorie_goal || user?.daily_protein_g
                return (
                  <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>
                      Planning with your profile settings:
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                      <Chip
                        size="small"
                        label={`Cooks: ${cookingDays.map((d) => DAY_NAMES[d]).join(', ')}`}
                        variant="outlined"
                        color="primary"
                      />
                      {hasGoals && (
                        <Chip
                          size="small"
                          label={[
                            user.daily_calorie_goal && `${user.daily_calorie_goal} kcal`,
                            user.daily_protein_g && `${user.daily_protein_g}g protein`,
                          ].filter(Boolean).join(' · ')}
                          variant="outlined"
                          color="secondary"
                        />
                      )}
                      {!hasGoals && (
                        <Chip size="small" label="No macro goals set — set them in Account" variant="outlined" />
                      )}
                    </Stack>
                  </Box>
                )
              })()}

              <Divider sx={{ mb: 2 }} />

              {suggestError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSuggestError(null)}>
                  {suggestError}
                </Alert>
              )}
              <TextField
                label="Additional preferences (optional)"
                placeholder="e.g. high protein, no red meat, Mediterranean style…"
                value={preferences}
                onChange={(e) => { setPreferences(e.target.value); mealPlanSuggestStore.set({ preferences: e.target.value }) }}
                fullWidth
                multiline
                rows={2}
                disabled={suggesting}
              />
              {suggesting && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress sx={{ borderRadius: 99 }} />
                  {suggestStep && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      {suggestStep}
                    </Typography>
                  )}
                </Box>
              )}
            </>
          )}
        </DialogContent>
        {!suggestDone && (
          <DialogActions>
            <Button onClick={() => setSuggestOpen(false)}>
              {suggesting ? 'Run in Background' : 'Cancel'}
            </Button>
            <Button
              onClick={handleSuggest}
              variant="contained"
              startIcon={<AutoAwesomeIcon />}
              disabled={suggesting}
            >
              {suggesting ? 'Thinking…' : 'Suggest Meals'}
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </Box>
  )
}
