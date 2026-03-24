import { useState, useRef, useCallback } from 'react'
import {
  Box,
  Autocomplete,
  TextField,
  IconButton,
  Tooltip,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { listIngredients } from '../../api/ingredients'

export default function IngredientRow({ ingredient, index, onChange, onDelete }) {
  const [options, setOptions] = useState([])
  const [inputValue, setInputValue] = useState(ingredient.ingredient_name || '')
  const debounceTimer = useRef(null)

  const fetchIngredients = useCallback((search) => {
    clearTimeout(debounceTimer.current)
    if (!search || search.length < 1) {
      setOptions([])
      return
    }
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await listIngredients(search)
        const items = res.data?.results || res.data || []
        setOptions(items)
      } catch {
        setOptions([])
      }
    }, 300)
  }, [])

  const handleIngredientChange = (_event, value) => {
    if (typeof value === 'string') {
      onChange(index, { ...ingredient, ingredient_id: null, ingredient_name: value })
    } else if (value && value.id) {
      onChange(index, { ...ingredient, ingredient_id: value.id, ingredient_name: value.name })
    } else {
      onChange(index, { ...ingredient, ingredient_id: null, ingredient_name: '' })
    }
  }

  const handleInputChange = (_event, value) => {
    setInputValue(value)
    fetchIngredients(value)
    if (!value) {
      onChange(index, { ...ingredient, ingredient_id: null, ingredient_name: value })
    }
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1.5fr auto',
        gap: 1,
        alignItems: 'center',
        mb: 1,
      }}
    >
      <Autocomplete
        freeSolo
        options={options}
        getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
        inputValue={inputValue}
        onInputChange={handleInputChange}
        onChange={handleIngredientChange}
        size="small"
        renderInput={(params) => (
          <TextField {...params} label="Ingredient" placeholder="e.g. Chicken breast" required />
        )}
        filterOptions={(x) => x}
        noOptionsText="Type to search or add new"
      />

      <TextField
        label="Quantity"
        size="small"
        value={ingredient.quantity || ''}
        onChange={(e) => onChange(index, { ...ingredient, quantity: e.target.value })}
        placeholder="e.g. 200"
        type="number"
        inputProps={{ min: 0, step: 'any' }}
      />

      <TextField
        label="Unit"
        size="small"
        value={ingredient.unit || ''}
        onChange={(e) => onChange(index, { ...ingredient, unit: e.target.value })}
        placeholder="e.g. g"
      />

      <TextField
        label="Notes"
        size="small"
        value={ingredient.notes || ''}
        onChange={(e) => onChange(index, { ...ingredient, notes: e.target.value })}
        placeholder="e.g. diced"
      />

      <Tooltip title="Remove ingredient">
        <IconButton size="small" onClick={() => onDelete(index)} color="error">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  )
}
