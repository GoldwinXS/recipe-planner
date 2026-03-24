import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  TextField,
  Stack,
  Chip,
  Divider,
  IconButton,
  Paper,
  Grid,
  InputAdornment,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { getRecipe, createRecipe, updateRecipe } from '../api/recipes'
import IngredientRow from '../components/recipes/IngredientRow'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorAlert from '../components/common/ErrorAlert'

const emptyIngredient = () => ({
  ingredient_id: null,
  ingredient_name: '',
  quantity: '',
  unit: '',
  notes: '',
  _key: Math.random(),
})

export default function RecipeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({
    title: '',
    description: '',
    servings: 2,
    prep_time_minutes: 0,
    cook_time_minutes: 0,
    instructions: '',
    source: 'manual',
  })
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [ingredients, setIngredients] = useState([emptyIngredient()])
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isEdit) return
    async function load() {
      setLoading(true)
      try {
        const res = await getRecipe(id)
        const r = res.data
        setForm({
          title: r.title || '',
          description: r.description || '',
          servings: r.servings || 2,
          prep_time_minutes: r.prep_time_minutes || 0,
          cook_time_minutes: r.cook_time_minutes || 0,
          instructions: r.instructions || '',
          source: r.source || 'manual',
        })
        setTags(
          (r.tag_details || []).map((t) => t.name),
        )
        if (r.recipe_ingredients && r.recipe_ingredients.length > 0) {
          setIngredients(
            r.recipe_ingredients.map((ing) => ({
              ingredient_id: ing.ingredient_id,
              ingredient_name: ing.ingredient_name || '',
              quantity: ing.quantity || '',
              unit: ing.unit || '',
              notes: ing.notes || '',
              _key: Math.random(),
            })),
          )
        }
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, isEdit])

  const handleChange = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleTagKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault()
      const tag = tagInput.trim().replace(/,$/, '')
      if (tag && !tags.includes(tag)) {
        setTags((prev) => [...prev, tag])
      }
      setTagInput('')
    }
  }

  const removeTag = (tag) => setTags((prev) => prev.filter((t) => t !== tag))

  const handleIngredientChange = (index, updated) => {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? updated : ing)))
  }

  const handleIngredientDelete = (index) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddIngredient = () => {
    setIngredients((prev) => [...prev, emptyIngredient()])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const payload = {
        ...form,
        servings: Number(form.servings),
        prep_time_minutes: Number(form.prep_time_minutes),
        cook_time_minutes: Number(form.cook_time_minutes),
        tags,
        ingredients: ingredients
          .filter((ing) => ing.ingredient_name.trim())
          .map((ing) => ({
            name: ing.ingredient_name.trim(),
            quantity: parseFloat(ing.quantity) || 1,
            unit: ing.unit || '',
            notes: ing.notes || '',
          })),
      }

      if (isEdit) {
        await updateRecipe(id, payload)
        navigate(`/cookbook/${id}`)
      } else {
        const res = await createRecipe(payload)
        navigate(`/cookbook/${res.data.id}`)
      }
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <Box maxWidth={860} mx="auto">
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        Back
      </Button>

      <Typography variant="h4" fontWeight={700} mb={3}>
        {isEdit ? 'Edit Recipe' : 'New Recipe'}
      </Typography>

      <ErrorAlert error={error} onClose={() => setError(null)} />

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={2}>
            Basic Info
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Recipe Title"
              value={form.title}
              onChange={handleChange('title')}
              required
              fullWidth
              inputProps={{ maxLength: 200 }}
              placeholder="e.g. Classic Beef Stew"
            />
            <TextField
              label="Description"
              value={form.description}
              onChange={handleChange('description')}
              fullWidth
              multiline
              rows={2}
              placeholder="Brief description of the recipe"
            />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Servings"
                  type="number"
                  value={form.servings}
                  onChange={handleChange('servings')}
                  fullWidth
                  inputProps={{ min: 1, max: 100 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Prep Time"
                  type="number"
                  value={form.prep_time_minutes}
                  onChange={handleChange('prep_time_minutes')}
                  fullWidth
                  inputProps={{ min: 0 }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">min</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Cook Time"
                  type="number"
                  value={form.cook_time_minutes}
                  onChange={handleChange('cook_time_minutes')}
                  fullWidth
                  inputProps={{ min: 0 }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">min</InputAdornment>,
                  }}
                />
              </Grid>
            </Grid>

            {/* Tags */}
            <Box>
              <TextField
                label="Add Tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                fullWidth
                placeholder="Type tag and press Enter"
                helperText="Press Enter or comma to add a tag"
                size="small"
              />
              {tags.length > 0 && (
                <Stack direction="row" flexWrap="wrap" gap={0.75} mt={1}>
                  {tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      onDelete={() => removeTag(tag)}
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              Ingredients
            </Typography>
            <Button startIcon={<AddIcon />} size="small" onClick={handleAddIngredient}>
              Add Ingredient
            </Button>
          </Box>

          {/* Header row */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1.5fr auto',
              gap: 1,
              mb: 1,
              px: 0.5,
            }}
          >
            {['Ingredient', 'Qty', 'Unit', 'Notes', ''].map((h) => (
              <Typography key={h} variant="caption" color="text.secondary" fontWeight={600}>
                {h}
              </Typography>
            ))}
          </Box>
          <Divider sx={{ mb: 1.5 }} />

          {ingredients.map((ing, i) => (
            <IngredientRow
              key={ing._key}
              ingredient={ing}
              index={i}
              onChange={handleIngredientChange}
              onDelete={handleIngredientDelete}
            />
          ))}

          {ingredients.length === 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              No ingredients added yet
            </Typography>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={2}>
            Instructions
          </Typography>
          <TextField
            value={form.instructions}
            onChange={handleChange('instructions')}
            fullWidth
            multiline
            rows={10}
            placeholder="Step 1: ...&#10;Step 2: ...&#10;..."
          />
        </Paper>

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button onClick={() => navigate(-1)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" size="large" disabled={submitting}>
            {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Recipe'}
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}
