import { useState, useEffect } from 'react'
import { Box, LinearProgress, Typography, IconButton, Collapse } from '@mui/material'
import { alpha } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { useWebLLM } from '../../contexts/WebLLMContext'
import useProviderConfig from '../../hooks/useProviderConfig'

export default function ModelStatusBanner() {
  const { status, progress, loadError } = useWebLLM()
  const [providerConfig] = useProviderConfig()
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const isBrowser = providerConfig.provider === 'browser'

  useEffect(() => {
    if (!isBrowser) { setVisible(false); return }

    if (status === 'loading') {
      setDismissed(false)
      setVisible(true)
    } else if (status === 'ready') {
      setDismissed(false)
      setVisible(true)
      const t = setTimeout(() => setVisible(false), 3000)
      return () => clearTimeout(t)
    } else if (loadError) {
      setDismissed(false)
      setVisible(true)
    } else {
      setVisible(false)
    }
  }, [status, loadError, isBrowser])

  if (!isBrowser || !visible || dismissed) return null

  const isLoading = status === 'loading'
  const isReady = status === 'ready'
  const isError = !isLoading && !isReady && !!loadError

  return (
    <Collapse in={visible}>
      <Box
        sx={{
          position: 'fixed',
          bottom: { xs: 72, md: 16 },
          left: 16,
          right: { xs: 16, md: 'auto' },
          width: { xs: 'auto', md: 360 },
          zIndex: 1400,
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          bgcolor: isReady
            ? 'success.dark'
            : isError
              ? 'error.dark'
              : (theme) => theme.palette.mode === 'dark' ? alpha('#1c1c1e', 0.97) : '#fff',
          border: '1px solid',
          borderColor: isReady ? 'success.main' : isError ? 'error.main' : 'divider',
        }}
      >
        {isLoading && (
          <LinearProgress
            variant={progress.value > 0 ? 'determinate' : 'indeterminate'}
            value={progress.value}
          />
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
          {isReady && <CheckCircleIcon sx={{ fontSize: 18, color: '#fff', flexShrink: 0 }} />}
          {isError && <ErrorOutlineIcon sx={{ fontSize: 18, color: '#fff', flexShrink: 0 }} />}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              fontWeight={600}
              color={isReady || isError ? '#fff' : 'text.primary'}
            >
              {isLoading && 'Downloading AI model…'}
              {isReady && 'AI model ready'}
              {isError && 'Failed to load AI model'}
            </Typography>
            {isLoading && (
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {progress.text || 'Initialising…'}
                {progress.value > 0 ? ` — ${progress.value}%` : ''}
              </Typography>
            )}
            {isError && (
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }} noWrap display="block">
                {loadError}
              </Typography>
            )}
          </Box>
          {!isLoading && (
            <IconButton
              size="small"
              onClick={() => setDismissed(true)}
              sx={{ color: isReady || isError ? '#fff' : 'text.secondary', flexShrink: 0 }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
      </Box>
    </Collapse>
  )
}
