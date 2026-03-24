import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { Box, Typography, Tooltip } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import DashboardIcon from '@mui/icons-material/Dashboard'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import { recipeGenStore, mealPlanSuggestStore } from '../../state/generationStore'

const navItems = [
  { label: 'Dashboard',      path: '/dashboard',    icon: DashboardIcon },
  { label: 'Cookbook',       path: '/cookbook',     icon: MenuBookIcon },
  { label: 'Generate Recipe',path: '/generate',     icon: AutoAwesomeIcon },
  { label: 'Meal Planner',   path: '/meal-planner', icon: CalendarMonthIcon },
  { label: 'Shopping List',  path: '/shopping',     icon: ShoppingCartIcon },
]

export default function NavLinks({ onClose, collapsed = false }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [recipeRunning, setRecipeRunning] = useState(recipeGenStore.get().generating)
  const [planRunning, setPlanRunning] = useState(mealPlanSuggestStore.get().suggesting)

  useEffect(() => {
    const u1 = recipeGenStore.subscribe((s) => setRecipeRunning(s.generating))
    const u2 = mealPlanSuggestStore.subscribe((s) => setPlanRunning(s.suggesting))
    return () => { u1(); u2() }
  }, [])

  const busyPaths = new Set([
    ...(recipeRunning ? ['/generate'] : []),
    ...(planRunning ? ['/meal-planner'] : []),
  ])

  return (
    <Box sx={{ px: collapsed ? 0.75 : 1.5, pt: 1 }}>
      {navItems.map(({ label, path, icon: Icon }) => (
        <Tooltip key={path} title={collapsed ? label : ''} placement="right">
          <Box
            component={NavLink}
            to={path}
            onClick={onClose}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: collapsed ? 0 : 1.25,
              px: collapsed ? 0 : 1.5,
              py: 1,
              mb: 0.5,
              borderRadius: 99,
              textDecoration: 'none',
              color: 'text.secondary',
              transition: 'all 0.15s ease',
              justifyContent: collapsed ? 'center' : 'flex-start',
              '&:hover': {
                bgcolor: isDark ? alpha('#ffffff', 0.07) : alpha('#000000', 0.05),
                color: 'text.primary',
              },
              '&.active': {
                bgcolor: isDark
                  ? alpha(theme.palette.primary.main, 0.22)
                  : alpha(theme.palette.primary.main, 0.12),
                color: theme.palette.primary.main,
                fontWeight: 700,
              },
            }}
          >
            <Box sx={{ position: 'relative', flexShrink: 0, lineHeight: 0 }}>
              <Icon sx={{ fontSize: 18 }} />
              {busyPaths.has(path) && (
                <Box sx={{
                  position: 'absolute', top: -2, right: -2,
                  width: 7, height: 7, borderRadius: '50%',
                  bgcolor: 'warning.main',
                  animation: 'pulse 1.4s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.4 },
                  },
                }} />
              )}
            </Box>
            {!collapsed && (
              <Typography
                variant="body2"
                fontWeight="inherit"
                sx={{ color: 'inherit', letterSpacing: '-0.01em' }}
              >
                {label}
              </Typography>
            )}
          </Box>
        </Tooltip>
      ))}
    </Box>
  )
}
