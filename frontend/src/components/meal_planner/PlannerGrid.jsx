import { Fragment } from 'react'
import { Box, Typography, Paper, IconButton, Divider, Tooltip, Popover, Button, Stack } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DAY_NAMES, MEAL_TYPES, getWeekDays } from '../../utils/weekUtils'

const MEAL_CONFIG = {
  breakfast: { label: 'Breakfast', emoji: '🌅', light: '#fff8e1', dark: 'rgba(255,193,7,0.08)' },
  lunch:     { label: 'Lunch',     emoji: '☀️',  light: '#e8f5e9', dark: 'rgba(76,175,80,0.08)' },
  dinner:    { label: 'Dinner',    emoji: '🌙',  light: '#e3f2fd', dark: 'rgba(33,150,243,0.08)' },
  snack:     { label: 'Snack',     emoji: '🍎',  light: '#fce4ec', dark: 'rgba(233,30,99,0.08)' },
}

const STORAGE_LABELS = {
  freeze: { icon: '❄️', tip: 'Freeze this batch — will be eaten too far from cooking day to refrigerate safely' },
  fresh:  { icon: '🥗', tip: 'Cook and eat fresh — no advance prep' },
}

function RecipeChip({ entry, onRemove }) {
  const [anchor, setAnchor] = useState(null)
  const navigate = useNavigate()
  const storageInfo = STORAGE_LABELS[entry.storage]

  return (
    <>
      <Tooltip title={entry.recipe?.title} placement="top">
        <Box
          onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget) }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 0.5,
            bgcolor: entry.storage === 'freeze' ? 'info.main' : 'primary.main',
            color: 'primary.contrastText',
            borderRadius: 1,
            px: 1,
            py: 0.4,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 500,
            lineHeight: 1.3,
            mb: 0.5,
            '&:hover': { bgcolor: entry.storage === 'freeze' ? 'info.dark' : 'primary.dark' },
          }}
        >
          {storageInfo && (
            <Tooltip title={storageInfo.tip} placement="top">
              <Typography component="span" sx={{ fontSize: 10, lineHeight: 1, flexShrink: 0 }}>
                {storageInfo.icon}
              </Typography>
            </Tooltip>
          )}
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 500,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              flexGrow: 1,
            }}
          >
            {entry.recipe?.title}
          </Typography>
          <CloseIcon
            sx={{ fontSize: 13, opacity: 0.7, flexShrink: 0, '&:hover': { opacity: 1 } }}
            onClick={(e) => { e.stopPropagation(); onRemove(entry.id) }}
          />
        </Box>
      </Tooltip>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <Box sx={{ p: 1.5, minWidth: 180 }}>
          <Typography variant="body2" fontWeight={600} gutterBottom sx={{ maxWidth: 220 }}>
            {entry.recipe?.title}
          </Typography>
          {entry.servings && (
            <Typography variant="caption" color="text.secondary" display="block">
              {entry.servings} serving{entry.servings !== 1 ? 's' : ''}
            </Typography>
          )}
          {storageInfo && (
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              {storageInfo.icon} {storageInfo.tip}
            </Typography>
          )}
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
              onClick={() => { navigate(`/cookbook/${entry.recipe?.id}`); setAnchor(null) }}
            >
              View
            </Button>
            <Button size="small" variant="outlined" color="error" onClick={() => { onRemove(entry.id); setAnchor(null) }}>
              Remove
            </Button>
          </Stack>
        </Box>
      </Popover>
    </>
  )
}

function MealSection({ mealType, dayIndex, entries, onAdd, onRemove }) {
  const cfg = MEAL_CONFIG[mealType]
  const theme = useTheme()
  const cellEntries = entries.filter((e) => e.day === dayIndex && e.meal_type === mealType)
  const bgColor = theme.palette.mode === 'dark' ? cfg.dark : cfg.light

  return (
    <Box
      sx={{
        px: 1,
        py: 0.75,
        bgcolor: bgColor,
        minHeight: 52,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {cfg.emoji} {cfg.label}
        </Typography>
        <IconButton
          size="small"
          onClick={() => onAdd(dayIndex, mealType)}
          sx={{ p: 0.25, opacity: 0.5, '&:hover': { opacity: 1 } }}
        >
          <AddCircleOutlineIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>
      {cellEntries.map((entry) => (
        <RecipeChip key={entry.id} entry={entry} onRemove={onRemove} />
      ))}
    </Box>
  )
}

function DayCard({ dayIndex, date, entries, onAdd, onRemove, isToday }) {
  const theme = useTheme()

  return (
    <Paper
      variant="outlined"
      sx={{
        flex: '0 0 auto',
        width: { xs: 'calc(100vw - 32px)', sm: 160, md: 180 },
        borderRadius: 2,
        overflow: 'hidden',
        borderColor: isToday ? 'primary.main' : 'divider',
        borderWidth: isToday ? 2 : 1,
        scrollSnapAlign: 'start',
      }}
    >
      {/* Day header */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          bgcolor: isToday ? 'primary.main' : theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100',
          color: isToday ? 'primary.contrastText' : 'text.primary',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: 13 }}>
          {DAY_NAMES[dayIndex]}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.75, fontSize: 11 }}>
          {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </Typography>
      </Box>

      {/* Meal sections */}
      {MEAL_TYPES.map((meal, i) => (
        <Fragment key={meal}>
          {i > 0 && <Divider />}
          <MealSection
            mealType={meal}
            dayIndex={dayIndex}
            entries={entries}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        </Fragment>
      ))}
    </Paper>
  )
}

export default function PlannerGrid({ weekStart, entries, onAdd, onRemove }) {
  const weekDays = getWeekDays(weekStart)
  const todayStr = new Date().toDateString()

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        overflowX: 'auto',
        pb: 1,
        scrollSnapType: 'x mandatory',
        // Ensure today's card is visible on first render on mobile
        '&::-webkit-scrollbar': { height: 6 },
        '&::-webkit-scrollbar-thumb': { borderRadius: 3, bgcolor: 'divider' },
      }}
    >
      {weekDays.map((day, i) => (
        <DayCard
          key={i}
          dayIndex={i}
          date={day}
          entries={entries}
          onAdd={onAdd}
          onRemove={onRemove}
          isToday={day.toDateString() === todayStr}
        />
      ))}
    </Box>
  )
}
