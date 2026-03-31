import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  MobileStepper,
  useMediaQuery,
} from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import SmartToyIcon from '@mui/icons-material/SmartToy'

const STORAGE_KEY = 'recipeplanner_onboarding_v1_done'

const STEPS = [
  {
    icon: <Typography sx={{ fontSize: 48, lineHeight: 1 }}>🥗</Typography>,
    title: 'Welcome to Recipe Planner',
    body: 'Plan your meals, track your nutrition, and let AI do the heavy lifting. Here\'s a quick overview to get you started.',
  },
  {
    icon: <MenuBookIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    title: 'Build your cookbook',
    body: 'Add recipes manually, paste in text from any website, or use AI to generate recipes from a simple description. Your cookbook is the foundation of everything.',
  },
  {
    icon: <CalendarMonthIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    title: 'Plan your week',
    body: 'Drag recipes onto your weekly meal planner. AI can suggest a full week (or month) of meals based on your cookbook, cooking days, and nutrition goals — including smart storage guidance.',
  },
  {
    icon: <SmartToyIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    title: 'Choose your AI',
    body: 'Use Claude (needs an API key in settings), Ollama for a local model, or the Browser AI — no server needed, runs entirely on your device. Tap the robot icon in the top bar to configure.',
  },
]

export default function OnboardingDialog() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true)
    }
  }, [])

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setOpen(false)
  }

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    } else {
      handleClose()
    }
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: 'hidden',
          bgcolor: isDark ? alpha('#1c1c1e', 0.98) : '#fff',
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Illustration area */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 140,
            background: isDark
              ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.3)}, ${alpha('#1c1c2e', 0.5)})`
              : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.2)}, ${alpha(theme.palette.primary.main, 0.06)})`,
          }}
        >
          {current.icon}
        </Box>

        {/* Text content */}
        <Box sx={{ px: 3, pt: 2.5, pb: 1 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            {current.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            {current.body}
          </Typography>
        </Box>

        {/* Footer */}
        <Box sx={{ px: 2, pb: 2.5, pt: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <MobileStepper
            variant="dots"
            steps={STEPS.length}
            position="static"
            activeStep={step}
            sx={{ flexGrow: 0, bgcolor: 'transparent', p: 0 }}
            nextButton={null}
            backButton={null}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            {step < STEPS.length - 1 && (
              <Button
                size="small"
                onClick={handleClose}
                sx={{ borderRadius: 99, color: 'text.secondary', fontSize: 13 }}
              >
                Skip
              </Button>
            )}
            <Button
              variant="contained"
              size="small"
              onClick={handleNext}
              startIcon={isLast ? null : <AutoAwesomeIcon sx={{ fontSize: 14 }} />}
              sx={{ borderRadius: 99, px: 2.5, fontWeight: 600, fontSize: 13 }}
            >
              {isLast ? 'Get started' : 'Next'}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  )
}
