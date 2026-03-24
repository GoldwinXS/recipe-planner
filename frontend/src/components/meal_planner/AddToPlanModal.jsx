import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Autocomplete,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
} from '@mui/material'
import { listRecipes } from '../../api/recipes'
import { DAY_NAMES, MEAL_TYPES } from '../../utils/weekUtils'

const MEAL_LABELS = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

export default function AddToPlanModal({ open, onClose, onAdd, defaultDay, defaultMealType, weekDays: weekDayStrings }) {
  const [recipes, setRecipes] = useState([])
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  // defaultDay is now an integer (0-6), or null
  const [selectedDay, setSelectedDay] = useState(defaultDay ?? 0)
  const [selectedMealType, setSelectedMealType] = useState(defaultMealType || 'dinner')
  const [servings, setServings] = useState(1)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setSelectedDay(defaultDay ?? 0)
      setSelectedMealType(defaultMealType || 'dinner')
      setSelectedRecipe(null)
      setServings(1)
    }
  }, [open, defaultDay, defaultMealType])

  useEffect(() => {
    async function fetchRecipes() {
      setLoading(true)
      try {
        const res = await listRecipes({ page_size: 200 })
        const items = res.data?.results || res.data || []
        setRecipes(items)
      } catch {
        setRecipes([])
      } finally {
        setLoading(false)
      }
    }
    if (open) fetchRecipes()
  }, [open])

  const handleSubmit = async () => {
    if (!selectedRecipe || selectedDay === null || selectedDay === undefined || !selectedMealType) return
    setSubmitting(true)
    try {
      await onAdd({
        recipe: selectedRecipe.id,
        day: selectedDay,
        meal_type: selectedMealType,
        servings: Number(servings),
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add to Meal Plan</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Autocomplete
            options={recipes}
            getOptionLabel={(opt) => opt.title || ''}
            value={selectedRecipe}
            onChange={(_e, val) => {
              setSelectedRecipe(val)
              if (val?.servings) setServings(val.servings)
            }}
            loading={loading}
            renderInput={(params) => (
              <TextField {...params} label="Recipe" required placeholder="Search recipes..." />
            )}
            noOptionsText="No recipes found"
          />

          <FormControl fullWidth required>
            <InputLabel>Day</InputLabel>
            <Select
              value={selectedDay}
              label="Day"
              onChange={(e) => setSelectedDay(e.target.value)}
            >
              {DAY_NAMES.map((name, i) => {
                const dateLabel = weekDayStrings?.[i]
                  ? new Date(weekDayStrings[i] + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  : ''
                return (
                  <MenuItem key={i} value={i}>
                    {name}{dateLabel ? ` — ${dateLabel}` : ''}
                  </MenuItem>
                )
              })}
            </Select>
          </FormControl>

          <FormControl fullWidth required>
            <InputLabel>Meal Type</InputLabel>
            <Select
              value={selectedMealType}
              label="Meal Type"
              onChange={(e) => setSelectedMealType(e.target.value)}
            >
              {MEAL_TYPES.map((m) => (
                <MenuItem key={m} value={m}>
                  {MEAL_LABELS[m]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Servings"
            type="number"
            value={servings}
            onChange={(e) => setServings(Math.max(1, parseInt(e.target.value, 10) || 1))}
            inputProps={{ min: 1 }}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!selectedRecipe || selectedDay === null || submitting}
        >
          Add to Plan
        </Button>
      </DialogActions>
    </Dialog>
  )
}
