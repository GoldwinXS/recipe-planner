import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Checkbox,
  Divider,
} from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import RefreshIcon from '@mui/icons-material/Refresh'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha'
import StorefrontIcon from '@mui/icons-material/Storefront'
import CategoryIcon from '@mui/icons-material/Category'
import { getShoppingList, toggleItem, clearList } from '../api/shopping'
import ErrorAlert from '../components/common/ErrorAlert'
import { getMonday, formatWeekStart } from '../utils/weekUtils'

// ─── Sort modes ───────────────────────────────────────────────────────────────

const SORT_MODES = [
  { id: 'category',  label: 'Category',   icon: <CategoryIcon   sx={{ fontSize: 14 }} /> },
  { id: 'aisle',     label: 'Store Aisle', icon: <StorefrontIcon sx={{ fontSize: 14 }} /> },
  { id: 'alpha',     label: 'A–Z',         icon: <SortByAlphaIcon sx={{ fontSize: 14 }} /> },
]

// ─── Category grouping ────────────────────────────────────────────────────────

const CATEGORY_ORDER = ['protein', 'vegetable', 'carb', 'dairy', 'spice', 'other']
const CATEGORY_LABELS = {
  protein:   'Protein',
  vegetable: 'Vegetables',
  carb:      'Bread, Pasta & Grains',
  dairy:     'Dairy',
  spice:     'Spices & Herbs',
  other:     'Other',
}

// ─── Store aisle grouping ─────────────────────────────────────────────────────

const AISLE_MAP = {
  vegetable: 'produce',
  protein:   'meat',
  dairy:     'dairy',
  carb:      'grains',
  spice:     'spices',
  other:     'pantry',
}

const AISLE_ORDER  = ['produce', 'meat', 'dairy', 'grains', 'spices', 'pantry']
const AISLE_LABELS = {
  produce: '🥦  Produce',
  meat:    '🥩  Meat & Seafood',
  dairy:   '🥛  Dairy & Eggs',
  grains:  '🌾  Bread, Pasta & Grains',
  spices:  '🧂  Spices & Condiments',
  pantry:  '🥫  Pantry & Canned Goods',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategory(item) {
  return item.ingredient_category || item.ingredient?.category || item.category || 'other'
}

function getItemName(item) {
  return item.ingredient?.name || item.ingredient_name || 'Unknown item'
}

function groupBy(items, keyFn, order, labelMap) {
  const groups = {}
  for (const item of items) {
    const key = keyFn(item)
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  return order
    .filter((k) => groups[k]?.length > 0)
    .map((k) => ({ key: k, label: labelMap[k] || k, items: groups[k] }))
}

function groupAlpha(items) {
  const sorted = [...items].sort((a, b) =>
    getItemName(a).localeCompare(getItemName(b)),
  )
  const groups = {}
  for (const item of sorted) {
    const letter = getItemName(item)[0]?.toUpperCase() || '#'
    if (!groups[letter]) groups[letter] = []
    groups[letter].push(item)
  }
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, grpItems]) => ({ key: letter, label: letter, items: grpItems }))
}

// ─── SortPill ─────────────────────────────────────────────────────────────────

function SortPill({ value, onChange }) {
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
      {SORT_MODES.map((m) => {
        const active = m.id === value
        return (
          <Box
            key={m.id}
            onClick={() => onChange(m.id)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.6,
              px: 1.5,
              py: 0.6,
              borderRadius: 99,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              transition: 'all 0.15s ease',
              bgcolor: active
                ? theme.palette.mode === 'dark' ? alpha('#ffffff', 0.12) : '#ffffff'
                : 'transparent',
              color: active ? 'text.primary' : 'text.secondary',
              boxShadow: active
                ? theme.palette.mode === 'dark'
                  ? '0 1px 4px rgba(0,0,0,0.4)'
                  : '0 1px 4px rgba(0,0,0,0.08)'
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

// ─── Group section ────────────────────────────────────────────────────────────

function GroupSection({ label, items, onToggle, isLast }) {
  const theme = useTheme()
  return (
    <Box sx={{ mb: isLast ? 0 : 2 }}>
      <Typography
        variant="overline"
        sx={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: 'text.secondary',
          px: 1,
          display: 'block',
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          bgcolor: theme.palette.mode === 'dark' ? alpha('#ffffff', 0.02) : '#ffffff',
        }}
      >
        {items.map((item, idx) => {
          const name = getItemName(item)
          const qty = item.total_quantity ?? item.quantity
          const unit = item.unit || ''
          const secondary = [qty, unit].filter(Boolean).join(' ')

          return (
            <Box key={item.id}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 1.5,
                  py: 1,
                  gap: 1,
                  opacity: item.checked ? 0.45 : 1,
                  transition: 'opacity 0.2s, background 0.15s',
                  '&:hover': {
                    bgcolor: theme.palette.mode === 'dark'
                      ? alpha('#ffffff', 0.04)
                      : alpha('#000000', 0.02),
                  },
                }}
              >
                <Checkbox
                  edge="start"
                  checked={!!item.checked}
                  onChange={() => onToggle(item.id)}
                  size="small"
                  color="primary"
                  sx={{ p: 0.5 }}
                />
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    fontWeight={500}
                    noWrap
                    sx={{ textDecoration: item.checked ? 'line-through' : 'none' }}
                  >
                    {name}
                  </Typography>
                  {secondary && (
                    <Typography variant="caption" color="text.secondary">
                      {secondary}
                    </Typography>
                  )}
                </Box>
              </Box>
              {idx < items.length - 1 && (
                <Divider sx={{ ml: 5.5 }} />
              )}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ShoppingList() {
  const [searchParams] = useSearchParams()
  const weekParam = searchParams.get('week')
  const weekStart = weekParam || formatWeekStart(getMonday(new Date()))

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [sortMode, setSortMode] = useState('category')

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getShoppingList(weekStart)
      const data = res.data
      setItems(data?.items || data || [])
    } catch (err) {
      if (err.response?.status === 404) {
        setItems([])
      } else {
        setError(err)
      }
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => {
    loadList()
  }, [loadList])

  const handleToggle = async (itemId) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, checked: !item.checked } : item)),
    )
    try {
      await toggleItem(weekStart, itemId)
    } catch (err) {
      setError(err)
      setItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, checked: !item.checked } : item)),
      )
    }
  }

  const handleClear = async () => {
    setClearing(true)
    try {
      await clearList(weekStart)
      setItems([])
      setClearDialogOpen(false)
    } catch (err) {
      setError(err)
    } finally {
      setClearing(false)
    }
  }

  // Build groups based on sort mode
  const groups =
    sortMode === 'aisle'
      ? groupBy(items, (item) => AISLE_MAP[getCategory(item)] || 'pantry', AISLE_ORDER, AISLE_LABELS)
      : sortMode === 'alpha'
        ? groupAlpha(items)
        : groupBy(items, getCategory, CATEGORY_ORDER, CATEGORY_LABELS)

  const checkedCount = items.filter((i) => i.checked).length
  const totalCount = items.length

  const weekLabel = new Date(weekStart + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <Box maxWidth={680} mx="auto">
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.025em', mb: 0.25 }}>
              Shopping List
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Week of {weekLabel}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              startIcon={<RefreshIcon />}
              onClick={loadList}
              disabled={loading}
              size="small"
              variant="outlined"
              sx={{ borderRadius: 99 }}
            >
              Refresh
            </Button>
            {items.length > 0 && (
              <Button
                startIcon={<DeleteSweepIcon />}
                onClick={() => setClearDialogOpen(true)}
                color="error"
                variant="outlined"
                size="small"
                sx={{ borderRadius: 99 }}
              >
                Clear
              </Button>
            )}
          </Stack>
        </Box>
      </Box>

      <ErrorAlert error={error} onClose={() => setError(null)} />

      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 99 }} />}

      {/* Progress + sort row */}
      {!loading && totalCount > 0 && (
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <LinearProgress
              variant="determinate"
              value={(checkedCount / totalCount) * 100}
              sx={{ flexGrow: 1, borderRadius: 99, height: 6 }}
            />
            <Chip
              label={`${checkedCount} / ${totalCount}`}
              size="small"
              color={checkedCount === totalCount ? 'success' : 'default'}
              sx={{ borderRadius: 99, fontSize: 11 }}
            />
          </Box>
          <SortPill value={sortMode} onChange={setSortMode} />
        </Box>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <Box
          sx={{
            textAlign: 'center',
            py: 7,
            px: 3,
            borderRadius: 4,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <ShoppingCartIcon sx={{ fontSize: 48, opacity: 0.2, mb: 1 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom fontWeight={600}>
            Your shopping list is empty
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add recipes to your meal plan and generate a shopping list from the Meal Planner.
          </Typography>
        </Box>
      )}

      {/* Groups */}
      {groups.map((group, idx) => (
        <GroupSection
          key={group.key}
          label={group.label}
          items={group.items}
          onToggle={handleToggle}
          isLast={idx === groups.length - 1}
        />
      ))}

      {/* Clear dialog */}
      <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)}>
        <DialogTitle>Clear Shopping List</DialogTitle>
        <DialogContent>
          <Typography>
            Clear all items from this shopping list? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)} disabled={clearing}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleClear} disabled={clearing}>
            {clearing ? 'Clearing…' : 'Clear List'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
