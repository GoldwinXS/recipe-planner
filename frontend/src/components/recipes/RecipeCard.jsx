import { useNavigate } from 'react-router-dom'
import { Box, Typography, Chip, Stack, Checkbox } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SourceBadge from './SourceBadge'

export default function RecipeCard({ recipe, selectable = false, selected = false, onSelect }) {
  const navigate = useNavigate()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)

  const handleClick = () => {
    if (selectable) onSelect?.(recipe.id)
    else navigate(`/cookbook/${recipe.id}`)
  }

  return (
    <Box
      onClick={handleClick}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRadius: 4,
        cursor: 'pointer',
        bgcolor: isDark ? alpha('#ffffff', 0.04) : '#ffffff',
        border: '1px solid',
        borderColor: selected
          ? theme.palette.primary.main
          : isDark ? alpha('#ffffff', 0.07) : alpha('#000000', 0.07),
        boxShadow: selected
          ? `0 0 0 2px ${alpha(theme.palette.primary.main, 0.3)}`
          : isDark
            ? '0 1px 3px rgba(0,0,0,0.4)'
            : '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'all 0.18s ease',
        overflow: 'hidden',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: isDark
            ? '0 8px 24px rgba(0,0,0,0.5)'
            : '0 8px 24px rgba(0,0,0,0.1)',
          borderColor: isDark ? alpha('#ffffff', 0.12) : alpha('#000000', 0.12),
        },
      }}
    >
      {selectable && (
        <Box sx={{ position: 'absolute', top: 10, left: 10, zIndex: 1 }}>
          <Checkbox
            checked={selected}
            onChange={() => onSelect?.(recipe.id)}
            onClick={(e) => e.stopPropagation()}
            size="small"
            sx={{
              bgcolor: 'background.paper',
              borderRadius: 2,
              p: 0.25,
              boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            }}
          />
        </Box>
      )}

      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          p: 2.5,
          pl: selectable ? 5.5 : 2.5,
        }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={700}
          noWrap
          sx={{ letterSpacing: '-0.01em' }}
        >
          {recipe.title}
        </Typography>

        {recipe.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              flexGrow: 1,
              lineHeight: 1.5,
            }}
          >
            {recipe.description}
          </Typography>
        )}

        {recipe.tags?.length > 0 && (
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {recipe.tags.slice(0, 3).map((tag) => (
              <Chip
                key={typeof tag === 'object' ? tag.id : tag}
                label={typeof tag === 'object' ? tag.name : tag}
                size="small"
                variant="outlined"
                color="primary"
                sx={{ height: 20, fontSize: 11 }}
              />
            ))}
            {recipe.tags.length > 3 && (
              <Chip label={`+${recipe.tags.length - 3}`} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
            )}
          </Stack>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto', pt: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {totalTime > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <AccessTimeIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                  {totalTime} min
                </Typography>
              </Box>
            )}
            <SourceBadge source={recipe.source} modelName={recipe.model_name} />
          </Box>
          <ChevronRightIcon sx={{ fontSize: 16, color: 'text.disabled', opacity: 0.5 }} />
        </Box>
      </Box>
    </Box>
  )
}
