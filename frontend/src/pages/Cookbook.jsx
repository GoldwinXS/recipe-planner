import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Stack,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Paper,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import CloseIcon from '@mui/icons-material/Close'
import { listRecipes, listTags, deleteRecipe } from '../api/recipes'
import RecipeGrid from '../components/recipes/RecipeGrid'
import ErrorAlert from '../components/common/ErrorAlert'

export default function Cookbook() {
  const [recipes, setRecipes] = useState([])
  const [tags, setTags] = useState([])
  const [search, setSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Selection
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const navigate = useNavigate()

  const fetchRecipes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (search) params.search = search
      if (selectedTags.length > 0) params.tags = selectedTags.join(',')
      const res = await listRecipes(params)
      const data = res.data?.results || res.data || []
      setRecipes(data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [search, selectedTags])

  useEffect(() => {
    const timer = setTimeout(fetchRecipes, 300)
    return () => clearTimeout(timer)
  }, [fetchRecipes])

  useEffect(() => {
    listTags()
      .then((res) => setTags(res.data?.results || res.data || []))
      .catch(() => {})
  }, [])

  const toggleTag = (tagName) => {
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName],
    )
  }

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleExitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds([])
  }

  const handleSelectAll = () => {
    if (selectedIds.length === recipes.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(recipes.map((r) => r.id))
    }
  }

  const handleDeleteConfirmed = async () => {
    setDeleting(true)
    try {
      await Promise.all(selectedIds.map((id) => deleteRecipe(id)))
      setRecipes((prev) => prev.filter((r) => !selectedIds.includes(r.id)))
      setSelectedIds([])
      setSelectMode(false)
    } catch (err) {
      setError(err)
    } finally {
      setDeleting(false)
      setConfirmOpen(false)
    }
  }

  return (
    <Box>
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
          Cookbook
        </Typography>
        {selectMode ? (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" onClick={handleSelectAll}>
              {selectedIds.length === recipes.length ? 'Deselect All' : 'Select All'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<CloseIcon />}
              onClick={handleExitSelectMode}
            >
              Cancel
            </Button>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<CheckBoxOutlineBlankIcon />}
              onClick={() => setSelectMode(true)}
            >
              Select
            </Button>
            <Button
              variant="outlined"
              startIcon={<AutoAwesomeIcon />}
              onClick={() => navigate('/generate')}
            >
              Generate with AI
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/cookbook/new')}
            >
              Add Recipe
            </Button>
          </Stack>
        )}
      </Box>

      <ErrorAlert error={error} onClose={() => setError(null)} />

      <TextField
        placeholder="Search recipes..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      {tags.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
            <Typography variant="body2" color="text.secondary" mr={0.5}>
              Filter:
            </Typography>
            {tags.map((tag) => {
              const tagName = typeof tag === 'object' ? tag.name : tag
              const selected = selectedTags.includes(tagName)
              return (
                <Chip
                  key={tagName}
                  label={tagName}
                  onClick={() => toggleTag(tagName)}
                  color={selected ? 'primary' : 'default'}
                  variant={selected ? 'filled' : 'outlined'}
                  size="small"
                  clickable
                />
              )
            })}
            {selectedTags.length > 0 && (
              <Chip
                label="Clear filters"
                size="small"
                onDelete={() => setSelectedTags([])}
                color="error"
                variant="outlined"
              />
            )}
          </Stack>
          <Divider sx={{ mt: 2 }} />
        </Box>
      )}

      <RecipeGrid
        recipes={recipes}
        loading={loading}
        selectable={selectMode}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
      />

      {/* Selection action bar */}
      {selectMode && (
        <Paper
          elevation={4}
          sx={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            px: 3,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            borderRadius: 3,
            zIndex: 1200,
            minWidth: 300,
          }}
        >
          <Typography variant="body1" fontWeight={500} sx={{ flexGrow: 1 }}>
            {selectedIds.length} selected
          </Typography>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            disabled={selectedIds.length === 0}
            onClick={() => setConfirmOpen(true)}
          >
            Delete
          </Button>
        </Paper>
      )}

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete {selectedIds.length} recipe{selectedIds.length !== 1 ? 's' : ''}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete {selectedIds.length === 1 ? 'this recipe' : `these ${selectedIds.length} recipes`}. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirmed}
            color="error"
            variant="contained"
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
