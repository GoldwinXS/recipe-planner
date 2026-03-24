import { Chip } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import EditNoteIcon from '@mui/icons-material/EditNote'
import LinkIcon from '@mui/icons-material/Link'
import MemoryIcon from '@mui/icons-material/Memory'

const SOURCE_CONFIG = {
  claude:        { label: 'Claude',  color: '#7c3aed', icon: AutoAwesomeIcon },
  ollama:        { label: 'Ollama',  color: '#e06c00', icon: AutoAwesomeIcon },
  openai_compat: { label: 'OpenAI',  color: '#10a37f', icon: AutoAwesomeIcon },
  browser:       { label: 'Browser', color: '#1565c0', icon: MemoryIcon },
  url:           { label: 'URL',     color: '#455a64', icon: LinkIcon },
}

export default function SourceBadge({ source, modelName, size = 'small' }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const cfg = SOURCE_CONFIG[source]

  if (!cfg) {
    return (
      <Chip
        icon={<EditNoteIcon sx={{ fontSize: '12px !important' }} />}
        label="Manual"
        size={size}
        sx={{
          height: 20,
          fontSize: 10,
          fontWeight: 600,
          bgcolor: isDark ? alpha('#ffffff', 0.08) : alpha('#000000', 0.07),
          color: 'text.secondary',
          '& .MuiChip-icon': { color: 'text.secondary' },
        }}
      />
    )
  }

  const Icon = cfg.icon
  const displayLabel = modelName ? `${modelName}` : cfg.label

  return (
    <Chip
      icon={<Icon sx={{ fontSize: '11px !important' }} />}
      label={displayLabel}
      size={size}
      sx={{
        height: 20,
        fontSize: 10,
        fontWeight: 600,
        maxWidth: 140,
        bgcolor: isDark ? alpha(cfg.color, 0.2) : alpha(cfg.color, 0.1),
        color: isDark ? alpha(cfg.color, 0.9) : cfg.color,
        border: `1px solid ${alpha(cfg.color, isDark ? 0.3 : 0.2)}`,
        '& .MuiChip-icon': { color: 'inherit' },
        '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
      }}
    />
  )
}
