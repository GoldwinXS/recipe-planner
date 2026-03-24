import { useState } from 'react'
import {
  Box,
  IconButton,
  Typography,
  Popover,
  Button,
  Stack,
  Tooltip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { useNavigate } from 'react-router-dom'

export default function PlannerCell({ day, mealType, entries, onAdd, onRemove }) {
  const [anchorEl, setAnchorEl] = useState(null)
  const [selectedEntry, setSelectedEntry] = useState(null)
  const navigate = useNavigate()

  // day is an integer 0-6 (Monday = 0)
  const cellEntries = entries.filter(
    (e) => e.day === day && e.meal_type === mealType,
  )

  const handleEntryClick = (event, entry) => {
    setSelectedEntry(entry)
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
    setSelectedEntry(null)
  }

  const handleView = () => {
    if (selectedEntry?.recipe?.id) {
      navigate(`/cookbook/${selectedEntry.recipe.id}`)
    }
    handleClose()
  }

  const handleRemove = () => {
    if (selectedEntry) {
      onRemove(selectedEntry.id)
    }
    handleClose()
  }

  return (
    <Box
      sx={{
        minHeight: 72,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 0.5,
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        position: 'relative',
      }}
    >
      {cellEntries.map((entry) => (
        <Tooltip key={entry.id} title={entry.recipe?.title || 'Recipe'} placement="top">
          <Box
            onClick={(e) => handleEntryClick(e, entry)}
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              borderRadius: 0.75,
              px: 0.75,
              py: 0.25,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 500,
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          >
            {entry.recipe?.title || 'Recipe'}
          </Box>
        </Tooltip>
      ))}

      <IconButton
        size="small"
        onClick={() => onAdd(day, mealType)}
        sx={{
          alignSelf: 'center',
          mt: 'auto',
          opacity: 0.5,
          '&:hover': { opacity: 1 },
          width: 24,
          height: 24,
        }}
      >
        <AddIcon sx={{ fontSize: 16 }} />
      </IconButton>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 1.5, minWidth: 160 }}>
          <Typography variant="body2" fontWeight={600} gutterBottom noWrap sx={{ maxWidth: 200 }}>
            {selectedEntry?.recipe?.title}
          </Typography>
          {selectedEntry?.servings && (
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              {selectedEntry.servings} serving{selectedEntry.servings !== 1 ? 's' : ''}
            </Typography>
          )}
          <Stack direction="row" spacing={1} mt={1}>
            <Button size="small" variant="outlined" onClick={handleView}>
              View
            </Button>
            <Button size="small" variant="outlined" color="error" onClick={handleRemove}>
              Remove
            </Button>
          </Stack>
        </Box>
      </Popover>
    </Box>
  )
}
