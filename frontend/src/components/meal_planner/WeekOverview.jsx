import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Stack, LinearProgress, Chip, Skeleton, Tooltip,
  Dialog, DialogTitle, DialogContent, IconButton, Divider,
} from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter'
import GrainIcon from '@mui/icons-material/Grain'
import WaterDropIcon from '@mui/icons-material/WaterDrop'
import CloseIcon from '@mui/icons-material/Close'
import { getMealPlanStats } from '../../api/mealPlans'
import { DAY_NAMES, getMonday, formatWeekStart } from '../../utils/weekUtils'

const MACROS = [
  { key: 'calories',  label: 'Calories', unit: 'kcal', icon: LocalFireDepartmentIcon, color: '#ef5350' },
  { key: 'protein_g', label: 'Protein',  unit: 'g',    icon: FitnessCenterIcon,       color: '#42a5f5' },
  { key: 'carbs_g',   label: 'Carbs',    unit: 'g',    icon: GrainIcon,               color: '#ffa726' },
  { key: 'fat_g',     label: 'Fat',      unit: 'g',    icon: WaterDropIcon,           color: '#66bb6a' },
]

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']
const MEAL_LABELS = { breakfast: 'Breakfast 🌅', lunch: 'Lunch ☀️', dinner: 'Dinner 🌙', snack: 'Snack 🍎' }

function MacroBar({ macro, avg, goal }) {
  const pct = goal ? Math.min(100, Math.round((avg / goal) * 100)) : null
  const color = !pct ? 'text.secondary'
    : pct >= 90 && pct <= 115 ? 'success.main'
    : pct > 115 ? 'error.main'
    : 'warning.main'
  const Icon = macro.icon

  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" alignItems="center" gap={0.5} mb={0.5}>
        <Box sx={{ color: macro.color, display: 'flex' }}><Icon sx={{ fontSize: 16 }} /></Box>
        <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10 }}>
          {macro.label}
        </Typography>
      </Stack>
      <Stack direction="row" alignItems="baseline" gap={0.5}>
        <Typography variant="h6" fontWeight={700} sx={{ fontSize: 18, lineHeight: 1 }}>
          {avg != null ? Math.round(avg) : '—'}
        </Typography>
        <Typography variant="caption" color="text.secondary">{macro.unit}</Typography>
        {goal && <Typography variant="caption" color="text.secondary">/ {goal}{macro.unit}</Typography>}
      </Stack>
      {goal && avg != null && (
        <Tooltip title={`${pct}% of daily goal`}>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{
              mt: 0.5,
              height: 5,
              borderRadius: 3,
              bgcolor: 'action.hover',
              '& .MuiLinearProgress-bar': { bgcolor: macro.color, borderRadius: 3 },
            }}
          />
        </Tooltip>
      )}
      {goal && <Typography variant="caption" sx={{ color, fontSize: 10 }}>{pct}%</Typography>}
    </Box>
  )
}

// ─── Day detail dialog ────────────────────────────────────────────────────────

function DayDialog({ open, onClose, dayIndex, weekStart, dayData, entries, goals }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const navigate = useNavigate()

  if (dayIndex == null) return null

  const monday = getMonday(new Date(weekStart + 'T00:00:00'))
  const dayDate = new Date(monday)
  dayDate.setDate(monday.getDate() + dayIndex)
  const dateLabel = dayDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  const dayEntries = (entries || []).filter((e) => e.day === dayIndex)

  // macros_per_serving is already per-serving, multiply by entry.servings
  const entryTotals = dayEntries.reduce(
    (acc, entry) => {
      const m = entry.recipe?.macros_per_serving
      if (!m?.complete) return acc
      const n = entry.servings || 1
      acc.calories  += (m.calories  || 0) * n
      acc.protein_g += (m.protein_g || 0) * n
      acc.carbs_g   += (m.carbs_g   || 0) * n
      acc.fat_g     += (m.fat_g     || 0) * n
      return acc
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  )

  // Prefer API-computed totals if available
  const totals = dayData?.has_data ? dayData : (dayEntries.length ? entryTotals : null)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4 } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight={700}>{dateLabel}</Typography>
          <IconButton size="small" onClick={onClose} sx={{ opacity: 0.5 }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        {dayEntries.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No meals planned for this day
          </Typography>
        ) : (
          <>
            {/* Meals by type */}
            {MEAL_TYPES.map((mealType) => {
              const meals = dayEntries.filter((e) => e.meal_type === mealType)
              if (!meals.length) return null
              return (
                <Box key={mealType} sx={{ mb: 2 }}>
                  <Typography variant="overline" sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'text.secondary' }}>
                    {MEAL_LABELS[mealType]}
                  </Typography>
                  {meals.map((entry) => {
                    const m = entry.recipe?.macros_per_serving
                    const kcal = m?.calories
                    return (
                      <Box
                        key={entry.id}
                        onClick={() => { onClose(); navigate(`/cookbook/${entry.recipe?.id}`) }}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          py: 0.75,
                          px: 1.5,
                          mt: 0.5,
                          borderRadius: 2,
                          cursor: 'pointer',
                          bgcolor: isDark ? alpha('#ffffff', 0.04) : alpha('#000000', 0.03),
                          transition: 'background 0.15s',
                          '&:hover': {
                            bgcolor: isDark ? alpha('#ffffff', 0.08) : alpha('#000000', 0.06),
                          },
                        }}
                      >
                        <Typography variant="body2" fontWeight={500} noWrap sx={{ flexGrow: 1, mr: 1 }}>
                          {entry.recipe?.title || 'Untitled'}
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                          {kcal != null && (
                            <Chip
                              label={`${Math.round(kcal)} kcal`}
                              size="small"
                              sx={{ height: 20, fontSize: 10, borderRadius: 99 }}
                            />
                          )}
                          <ChevronRightIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                        </Stack>
                      </Box>
                    )
                  })}
                </Box>
              )
            })}

            <Divider sx={{ my: 1.5 }} />

            {/* Daily totals */}
            {totals ? (
              <Box>
                <Typography variant="overline" sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'text.secondary', mb: 1.5, display: 'block' }}>
                  Daily Totals
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                  {MACROS.map((m) => {
                    const val = totals[m.key]
                    const goal = goals?.[m.key]
                    const pct = goal && val ? Math.min(100, Math.round((val / goal) * 100)) : null
                    const Icon = m.icon
                    return (
                      <Box
                        key={m.key}
                        sx={{
                          p: 1.25,
                          borderRadius: 2,
                          bgcolor: isDark ? alpha(m.color, 0.08) : alpha(m.color, 0.06),
                          border: '1px solid',
                          borderColor: alpha(m.color, isDark ? 0.2 : 0.15),
                        }}
                      >
                        <Stack direction="row" alignItems="center" gap={0.5} mb={0.25}>
                          <Icon sx={{ fontSize: 13, color: m.color }} />
                          <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {m.label}
                          </Typography>
                        </Stack>
                        <Typography fontWeight={700} sx={{ fontSize: 16, lineHeight: 1.2 }}>
                          {Math.round(val ?? 0)}
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.4 }}>
                            {m.unit}
                          </Typography>
                        </Typography>
                        {goal && (
                          <LinearProgress
                            variant="determinate"
                            value={pct || 0}
                            sx={{
                              mt: 0.75,
                              height: 3,
                              borderRadius: 99,
                              bgcolor: 'action.hover',
                              '& .MuiLinearProgress-bar': { bgcolor: m.color },
                            }}
                          />
                        )}
                        {goal && pct != null && (
                          <Typography sx={{ fontSize: 9, color: 'text.disabled', mt: 0.25 }}>{pct}%</Typography>
                        )}
                      </Box>
                    )
                  })}
                </Box>
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary">
                Add macro data to recipes to see daily totals.
              </Typography>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Day bar ──────────────────────────────────────────────────────────────────

function DayBar({ day, data, goals, onClick }) {
  const theme = useTheme()
  const maxCal = goals?.calories || 2200
  const pct = data?.has_data ? Math.min(100, (data.calories / maxCal) * 100) : 0
  const isGood = data?.has_data && data.calories >= maxCal * 0.8 && data.calories <= maxCal * 1.2

  const today = formatWeekStart(new Date())
  const monday = getMonday(new Date())
  const d = new Date(monday)
  d.setDate(monday.getDate() + day)
  const isToday = formatWeekStart(d) === today

  return (
    <Tooltip
      title={
        data?.has_data
          ? `${DAY_NAMES[day]}: ${Math.round(data.calories)} kcal · ${Math.round(data.protein_g)}g protein — click for details`
          : `${DAY_NAMES[day]}: no macro data — click to see meals`
      }
    >
      <Box
        onClick={onClick}
        sx={{
          flex: 1,
          minWidth: 0,
          textAlign: 'center',
          cursor: 'pointer',
          borderRadius: 2,
          py: 0.5,
          transition: 'background 0.15s',
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.08),
          },
        }}
      >
        <Box sx={{ height: 40, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', mb: 0.5 }}>
          {data?.has_data ? (
            <Box
              sx={{
                height: `${pct}%`,
                minHeight: 4,
                bgcolor: isGood ? 'success.main' : 'warning.main',
                borderRadius: '3px 3px 0 0',
                transition: 'height 0.3s ease',
              }}
            />
          ) : (
            <Box sx={{ height: 4, bgcolor: 'action.disabledBackground', borderRadius: '3px 3px 0 0' }} />
          )}
        </Box>
        <Typography
          sx={{
            fontSize: 10,
            fontWeight: isToday ? 800 : 600,
            color: isToday ? 'primary.main' : 'text.secondary',
          }}
        >
          {DAY_NAMES[day].slice(0, 1)}
        </Typography>
        {data?.has_data && (
          <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>
            {Math.round(data.calories / 100) / 10}k
          </Typography>
        )}
      </Box>
    </Tooltip>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WeekOverview({ weekStart, entries, initialOpenDay = null }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedDay, setSelectedDay] = useState(initialOpenDay)

  useEffect(() => {
    if (!weekStart || !entries?.length) { setStats(null); return }
    setLoading(true)
    getMealPlanStats(weekStart)
      .then((r) => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [weekStart, entries])

  if (!entries?.length) return null

  const avg = stats?.weekly_avg
  const goals = stats?.goals
  const days = stats?.days || []
  const hasData = avg?.days_with_data > 0

  return (
    <>
      <Box
        sx={{
          mt: 2,
          p: 2.5,
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: isDark ? alpha('#ffffff', 0.02) : '#ffffff',
          boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <Stack direction="row" alignItems="center" gap={1} mb={2}>
          <LocalFireDepartmentIcon color="error" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={700}>Week Overview</Typography>
          {hasData && avg && (
            <Chip
              size="small"
              label={`${avg.days_with_data}/7 days tracked`}
              variant="outlined"
              sx={{ ml: 'auto', fontSize: 11, borderRadius: 99 }}
            />
          )}
          {!goals?.calories && (
            <Chip size="small" label="Set macro goals in Account" variant="outlined" sx={{ ml: 'auto', fontSize: 11, borderRadius: 99 }} />
          )}
        </Stack>

        {loading ? (
          <Stack spacing={1}>
            <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 2 }} />
            <Skeleton variant="rectangular" height={24} sx={{ borderRadius: 2 }} />
          </Stack>
        ) : !hasData ? (
          <>
            {/* Still show clickable bars even without macro data */}
            <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, alignItems: 'flex-end', height: 60 }}>
              {Array.from({ length: 7 }, (_, i) => (
                <DayBar key={i} day={i} data={null} goals={goals} onClick={() => setSelectedDay(i)} />
              ))}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
              Click a day to see its meals. Add macro data to recipes to see nutrition estimates here.
            </Typography>
          </>
        ) : (
          <>
            {/* Calorie bar chart */}
            <Box sx={{ display: 'flex', gap: 0.5, mb: 2, alignItems: 'flex-end', height: 60 }}>
              {Array.from({ length: 7 }, (_, i) => (
                <DayBar key={i} day={i} data={days[i]} goals={goals} onClick={() => setSelectedDay(i)} />
              ))}
            </Box>

            {/* Macro summary */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
              {MACROS.map((m) => (
                <MacroBar key={m.key} macro={m} avg={avg?.[m.key]} goal={goals?.[m.key]} />
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
              Daily averages across {avg?.days_with_data} day{avg?.days_with_data !== 1 ? 's' : ''} with macro data.
              Click any bar to see that day&apos;s breakdown.
            </Typography>
          </>
        )}
      </Box>

      <DayDialog
        open={selectedDay != null}
        onClose={() => setSelectedDay(null)}
        dayIndex={selectedDay}
        weekStart={weekStart}
        dayData={days[selectedDay]}
        entries={entries}
        goals={goals}
      />
    </>
  )
}
