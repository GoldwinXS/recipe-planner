import { useState } from 'react'
import {
  Box, Typography, Paper, Button, Stack, Chip, Alert,
  LinearProgress, Accordion, AccordionSummary, AccordionDetails,
  Divider,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates'
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu'
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag'
import { getMealPlanPrepGuide } from '../../api/mealPlans'
import { loadProviderConfig } from '../../hooks/useProviderConfig'

function TaskCard({ task, index }) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        py: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {index + 1}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" gap={1} mb={0.5} flexWrap="wrap">
          <Typography variant="body2" fontWeight={700}>
            {task.title}
          </Typography>
          {task.duration_min > 0 && (
            <Chip
              size="small"
              icon={<AccessTimeIcon sx={{ fontSize: '12px !important' }} />}
              label={`${task.duration_min} min`}
              sx={{ height: 20, fontSize: 10 }}
              variant="outlined"
            />
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: task.tip ? 1 : 0 }}>
          {task.detail}
        </Typography>
        {task.tip && (
          <Stack direction="row" alignItems="flex-start" gap={0.75}>
            <TipsAndUpdatesIcon sx={{ fontSize: 14, color: 'warning.main', mt: 0.2, flexShrink: 0 }} />
            <Typography variant="caption" color="warning.dark" sx={{ fontStyle: 'italic' }}>
              {task.tip}
            </Typography>
          </Stack>
        )}
      </Box>
    </Box>
  )
}

function PrepDayAccordion({ prepDay, defaultExpanded }) {
  return (
    <Accordion defaultExpanded={defaultExpanded} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', mb: 1, '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2, py: 1 }}>
        <Stack direction="row" alignItems="center" gap={1.5} sx={{ flex: 1 }}>
          <RestaurantMenuIcon color="primary" sx={{ fontSize: 18 }} />
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>
              {prepDay.day_name}
            </Typography>
            {prepDay.total_duration_min > 0 && (
              <Typography variant="caption" color="text.secondary">
                ~{prepDay.total_duration_min} min total
              </Typography>
            )}
          </Box>
          <Chip
            size="small"
            label={`${prepDay.tasks?.length || 0} tasks`}
            sx={{ ml: 'auto', mr: 1, fontSize: 10 }}
            variant="outlined"
          />
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
        {prepDay.intro && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontStyle: 'italic' }}>
            {prepDay.intro}
          </Typography>
        )}
        {(prepDay.tasks || []).map((task, i) => (
          <TaskCard key={i} task={task} index={i} />
        ))}
      </AccordionDetails>
    </Accordion>
  )
}

export default function PrepGuide({ weekStart, entries }) {
  const [guide, setGuide] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const providerConfig = loadProviderConfig()
      const res = await getMealPlanPrepGuide(weekStart, providerConfig)
      setGuide(res.data)
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to generate prep guide.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!entries?.length) return null

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Stack direction="row" alignItems="center" gap={1} mb={guide ? 2 : 0}>
        <RestaurantMenuIcon color="primary" fontSize="small" />
        <Typography variant="subtitle1" fontWeight={700}>
          Meal Prep Guide
        </Typography>
        {!guide && !loading && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<AutoAwesomeIcon />}
            onClick={handleGenerate}
            sx={{ ml: 'auto' }}
          >
            Generate with AI
          </Button>
        )}
        {guide && !loading && (
          <Button
            size="small"
            variant="text"
            startIcon={<AutoAwesomeIcon />}
            onClick={handleGenerate}
            sx={{ ml: 'auto', fontSize: 11 }}
          >
            Regenerate
          </Button>
        )}
      </Stack>

      {loading && (
        <Box sx={{ mt: 1 }}>
          <LinearProgress sx={{ borderRadius: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            AI is planning your cooking days…
          </Typography>
        </Box>
      )}

      {error && !loading && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}

      {!guide && !loading && !error && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Get a personalized cooking schedule based on your meal plan and cooking days.
          AI will tell you what to prep fresh, what to batch cook, and how to store leftovers.
        </Typography>
      )}

      {guide && !loading && (
        <>
          {(guide.prep_days || []).map((day, i) => (
            <PrepDayAccordion key={i} prepDay={day} defaultExpanded={i === 0} />
          ))}

          {guide.shopping_tip && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Stack direction="row" alignItems="flex-start" gap={1}>
                <ShoppingBagIcon sx={{ fontSize: 16, color: 'success.main', mt: 0.2, flexShrink: 0 }} />
                <Typography variant="caption" color="text.secondary">
                  <strong>Shopping tip:</strong> {guide.shopping_tip}
                </Typography>
              </Stack>
            </>
          )}
        </>
      )}
    </Paper>
  )
}
