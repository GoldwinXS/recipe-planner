import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Chip, Stack, Skeleton,
  IconButton, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, Tooltip,
} from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { listRecipes, deleteRecipe } from '../api/recipes'
import { getMealPlan } from '../api/mealPlans'
import { getMonday, formatWeekStart, DAY_NAMES } from '../utils/weekUtils'
import ErrorAlert from '../components/common/ErrorAlert'
import useAuth from '../hooks/useAuth'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const [recipes, setRecipes] = useState([])
  const [mealPlan, setMealPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const weekStart = formatWeekStart(getMonday(new Date()))
  const today = formatWeekStart(new Date())

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [recipesRes, planRes] = await Promise.allSettled([
          listRecipes({ page_size: 6, ordering: '-created_at' }),
          getMealPlan(weekStart),
        ])
        if (recipesRes.status === 'fulfilled') {
          const data = recipesRes.value.data
          setRecipes(data?.results || data || [])
        }
        if (planRes.status === 'fulfilled') setMealPlan(planRes.value.data)
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [weekStart])

  const handleDeleteRecipe = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteRecipe(deleteTarget.id)
      setRecipes((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      setError(err)
    } finally {
      setDeleting(false)
    }
  }

  const entries = mealPlan?.entries || []

  return (
    <Box>
      <ErrorAlert error={error} onClose={() => setError(null)} />

      {/* ── Hero header ── */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h3"
          fontWeight={800}
          sx={{
            letterSpacing: '-0.025em',
            background: isDark
              ? `linear-gradient(135deg, #ffffff 40%, ${alpha(theme.palette.primary.light, 0.8)})`
              : `linear-gradient(135deg, #1c1c1e 40%, ${theme.palette.primary.main})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            mb: 0.5,
          }}
        >
          {getGreeting()}, {user?.username || 'there'}.
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here&apos;s your week at a glance
        </Typography>
      </Box>

      {/* ── Quick actions ── */}
      <Stack direction="row" spacing={1} sx={{ mb: 4 }}>
        <Button
          variant="contained"
          startIcon={<AutoAwesomeIcon />}
          onClick={() => navigate('/generate')}
          sx={{ px: 2.5 }}
        >
          Generate Recipe
        </Button>
        <Button
          variant="outlined"
          startIcon={<CalendarMonthIcon />}
          onClick={() => navigate('/meal-planner')}
          sx={{ px: 2.5 }}
        >
          Meal Planner
        </Button>
      </Stack>

      {/* ── This week strip ── */}
      <Box
        sx={{
          mb: 4,
          borderRadius: 4,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: isDark ? alpha('#ffffff', 0.03) : '#ffffff',
          boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2.5,
            py: 1.75,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarMonthIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={700}>
              This Week
            </Typography>
          </Box>
          <Button
            size="small"
            endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
            onClick={() => navigate('/meal-planner')}
            sx={{ borderRadius: 99, fontSize: 12 }}
          >
            Full Planner
          </Button>
        </Box>

        {/* Day grid */}
        <Box sx={{ p: 2, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
          {DAY_NAMES.map((day, i) => {
            const monday = getMonday(new Date())
            const d = new Date(monday)
            d.setDate(monday.getDate() + i)
            const dayStr = formatWeekStart(d)
            const isToday = dayStr === today
            const dayEntries = entries.filter((e) => e.day === i)

            return (
              <Box
                key={day}
                onClick={() => navigate(`/meal-planner?day=${i}`)}
                sx={{
                  borderRadius: 3,
                  pt: 1,
                  px: 1,
                  pb: 1.5,
                  minHeight: 80,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: isToday ? 'primary.main' : 'divider',
                  bgcolor: isToday
                    ? isDark ? alpha(theme.palette.primary.main, 0.15) : alpha(theme.palette.primary.main, 0.06)
                    : isDark ? alpha('#ffffff', 0.03) : alpha('#000000', 0.02),
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: isDark ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.primary.main, 0.05),
                  },
                }}
              >
                <Typography
                  variant="caption"
                  fontWeight={isToday ? 800 : 600}
                  color={isToday ? 'primary.main' : 'text.secondary'}
                  display="block"
                  textAlign="center"
                  sx={{ fontSize: 11, mb: 0.75, letterSpacing: '0.03em' }}
                >
                  {day.slice(0, 3)}
                </Typography>
                {loading ? (
                  <><Skeleton height={12} sx={{ borderRadius: 1 }} /><Skeleton height={12} sx={{ borderRadius: 1 }} /></>
                ) : (
                  <Stack spacing={0.35}>
                    {dayEntries.slice(0, 3).map((entry) => (
                      <Typography
                        key={entry.id}
                        sx={{
                          fontSize: 9,
                          fontWeight: 600,
                          bgcolor: isToday ? 'primary.main' : isDark ? alpha('#ffffff', 0.1) : alpha('#000000', 0.07),
                          color: isToday ? 'primary.contrastText' : 'text.secondary',
                          borderRadius: 1,
                          px: 0.6,
                          py: 0.3,
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {entry.recipe?.title}
                      </Typography>
                    ))}
                    {dayEntries.length === 0 && (
                      <Typography sx={{ fontSize: 9, color: 'text.disabled', textAlign: 'center', mt: 0.5 }}>—</Typography>
                    )}
                  </Stack>
                )}
              </Box>
            )
          })}
        </Box>
      </Box>

      {/* ── Recent Recipes ── */}
      <Box
        sx={{
          borderRadius: 4,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: isDark ? alpha('#ffffff', 0.03) : '#ffffff',
          boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <Box
          sx={{
            px: 2.5,
            py: 1.75,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle1" fontWeight={700}>Recent Recipes</Typography>
          <Button
            size="small"
            endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
            onClick={() => navigate('/cookbook')}
            sx={{ borderRadius: 99, fontSize: 12 }}
          >
            View All
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ p: 2 }}>
            {[1, 2, 3].map((n) => <Skeleton key={n} height={52} sx={{ borderRadius: 2, mb: 0.5 }} />)}
          </Box>
        ) : recipes.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 5, px: 3 }}>
            <Typography color="text.secondary" gutterBottom>No recipes yet</Typography>
            <Button variant="outlined" onClick={() => navigate('/cookbook/new')} sx={{ mt: 1 }}>
              Add your first recipe
            </Button>
          </Box>
        ) : (
          recipes.map((recipe, idx) => (
            <Box
              key={recipe.id}
              sx={{
                px: 2.5,
                py: 1.5,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: idx < recipes.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
                transition: 'background 0.15s',
                '&:hover': {
                  bgcolor: isDark ? alpha('#ffffff', 0.03) : alpha('#000000', 0.02),
                },
              }}
            >
              <Box
                sx={{ flexGrow: 1, cursor: 'pointer', minWidth: 0 }}
                onClick={() => navigate(`/cookbook/${recipe.id}`)}
              >
                <Typography variant="body2" fontWeight={600} noWrap>
                  {recipe.title}
                </Typography>
                {recipe.tags?.length > 0 && (
                  <Stack direction="row" spacing={0.5} mt={0.35}>
                    {recipe.tags.slice(0, 3).map((tag) => (
                      <Chip
                        key={typeof tag === 'object' ? tag.id : tag}
                        label={typeof tag === 'object' ? tag.name : tag}
                        size="small"
                        variant="outlined"
                        sx={{ height: 18, fontSize: 10 }}
                      />
                    ))}
                  </Stack>
                )}
              </Box>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0, ml: 1 }}>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(recipe) }}
                    sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }}
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <ChevronRightIcon
                  sx={{ fontSize: 18, color: 'text.disabled', cursor: 'pointer' }}
                  onClick={() => navigate(`/cookbook/${recipe.id}`)}
                />
              </Stack>
            </Box>
          ))
        )}
      </Box>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete recipe?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete &ldquo;{deleteTarget?.title}&rdquo;? This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
          <Button onClick={handleDeleteRecipe} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
