import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  Toolbar,
  Typography,
  Avatar,
  Tooltip,
  useMediaQuery,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Alert,
  Button,
} from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import LogoutIcon from '@mui/icons-material/Logout'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DashboardIcon from '@mui/icons-material/Dashboard'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import NavLinks from './NavLinks'
import AIProviderDialog from '../ai/AIProviderDialog'
import ModelStatusBanner from '../ai/ModelStatusBanner'
import OnboardingDialog from '../onboarding/OnboardingDialog'
import useAuth from '../../hooks/useAuth'
import { useColorMode } from '../../App'
import { loadProviderConfig } from '../../hooks/useProviderConfig'
import { recipeGenStore, mealPlanSuggestStore } from '../../state/generationStore'

const DRAWER_WIDTH = 224
const DRAWER_COLLAPSED_WIDTH = 68

const NAV_ITEMS = [
  { label: 'Home',     path: '/dashboard',    icon: DashboardIcon },
  { label: 'Cookbook', path: '/cookbook',     icon: MenuBookIcon },
  { label: 'Generate', path: '/generate',     icon: AutoAwesomeIcon },
  { label: 'Planner',  path: '/meal-planner', icon: CalendarMonthIcon },
  { label: 'Shopping', path: '/shopping',     icon: ShoppingCartIcon },
]

export default function AppShell() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [collapsed, setCollapsed] = useState(false)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const { user, logout } = useAuth()
  const { mode, toggleColorMode } = useColorMode()
  const navigate = useNavigate()
  const location = useLocation()

  const providerConfig = loadProviderConfig()
  const providerLabel =
    providerConfig.provider === 'ollama' ? 'Ollama' :
    providerConfig.provider === 'openai_compatible' ? 'OpenAI' :
    providerConfig.provider === 'browser' ? 'Browser' :
    'Claude'

  const drawerWidth = collapsed ? DRAWER_COLLAPSED_WIDTH : DRAWER_WIDTH

  const [recipeRunning, setRecipeRunning] = useState(recipeGenStore.get().generating)
  const [planRunning, setPlanRunning] = useState(mealPlanSuggestStore.get().suggesting)
  useEffect(() => {
    const u1 = recipeGenStore.subscribe((s) => setRecipeRunning(s.generating))
    const u2 = mealPlanSuggestStore.subscribe((s) => setPlanRunning(s.suggesting))
    return () => { u1(); u2() }
  }, [])
  const busyPaths = { '/generate': recipeRunning, '/meal-planner': planRunning }

  // Which bottom-nav tab is active
  const activeTab = NAV_ITEMS.findIndex((n) => location.pathname.startsWith(n.path))

  const drawerContent = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Brand + collapse toggle */}
      <Box
        sx={{
          px: collapsed ? 1 : 2,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: 52,
        }}
      >
        {!collapsed && (
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexGrow: 1, minWidth: 0 }}
            onClick={() => navigate('/dashboard')}
            style={{ cursor: 'pointer' }}
          >
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: 2,
                bgcolor: theme.palette.primary.main,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Typography sx={{ color: '#fff', fontSize: 16, lineHeight: 1 }}>🥗</Typography>
            </Box>
            <Typography
              variant="subtitle1"
              fontWeight={700}
              sx={{ letterSpacing: '-0.02em', color: 'text.primary' }}
              noWrap
            >
              Recipe Planner
            </Typography>
          </Box>
        )}
        <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
          <IconButton
            size="small"
            onClick={() => setCollapsed((p) => !p)}
            sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
          >
            {collapsed ? (
              <ChevronRightIcon sx={{ fontSize: 18 }} />
            ) : (
              <ChevronLeftIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Nav links */}
      <NavLinks collapsed={collapsed} />

      <Box sx={{ flexGrow: 1 }} />

      {/* User row */}
      <Box sx={{ p: collapsed ? 1 : 1.5 }}>
        <Tooltip title={collapsed ? user?.username || 'Account' : ''} placement="right">
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: collapsed ? 0.5 : 1.5,
              py: 1,
              borderRadius: 99,
              cursor: 'pointer',
              justifyContent: collapsed ? 'center' : 'flex-start',
              transition: 'background 0.15s',
              '&:hover': {
                bgcolor: isDark ? alpha('#ffffff', 0.07) : alpha('#000000', 0.05),
              },
            }}
            onClick={() => navigate('/account')}
          >
            <Avatar
              sx={{
                width: 28,
                height: 28,
                bgcolor: theme.palette.primary.main,
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </Avatar>
            {!collapsed && (
              <>
                <Typography variant="body2" noWrap sx={{ flexGrow: 1, fontWeight: 500, fontSize: 13 }}>
                  {user?.username || 'User'}
                </Typography>
                <Tooltip title="Logout">
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); logout().then(() => navigate('/login')) }}
                    sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                  >
                    <LogoutIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        </Tooltip>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar sx={{ minHeight: '52px !important', gap: 0.5 }}>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title={`AI: ${providerLabel} — click to change`}>
            <IconButton
              size="small"
              onClick={() => setAiDialogOpen(true)}
              sx={{
                borderRadius: 99,
                px: 1,
                gap: 0.5,
                fontSize: 12,
                fontWeight: 600,
                color: 'text.secondary',
                '&:hover': { color: 'text.primary', bgcolor: isDark ? alpha('#fff', 0.07) : alpha('#000', 0.05) },
              }}
            >
              <SmartToyIcon sx={{ fontSize: 17 }} />
              <Typography variant="caption" fontWeight={600} sx={{ display: { xs: 'none', sm: 'block' } }}>
                {providerLabel}
              </Typography>
            </IconButton>
          </Tooltip>
          <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <IconButton size="small" onClick={toggleColorMode} sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}>
              {mode === 'dark' ? <LightModeIcon sx={{ fontSize: 18 }} /> : <DarkModeIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
          {/* Mobile logout */}
          {isMobile && (
            <Tooltip title="Logout">
              <IconButton
                size="small"
                onClick={() => logout().then(() => navigate('/login'))}
                sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}
              >
                <LogoutIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Toolbar>
      </AppBar>

      <AIProviderDialog open={aiDialogOpen} onClose={() => setAiDialogOpen(false)} />
      <ModelStatusBanner />
      <OnboardingDialog />

      {/* Desktop sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            overflow: 'hidden',
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: { md: `${drawerWidth}px` },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar sx={{ minHeight: '52px !important' }} />
        {user?.is_demo_temp && (
          <Alert
            severity="info"
            icon={false}
            sx={{
              borderRadius: 0,
              py: 0.5,
              px: { xs: 2, sm: 3 },
              fontSize: 13,
              '& .MuiAlert-message': { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 },
            }}
          >
            <span>
              <strong>Demo session</strong> — explore freely. Your data will be deleted when you sign out.
            </span>
            <Button
              size="small"
              variant="outlined"
              color="info"
              sx={{ borderRadius: 99, fontSize: 11, py: 0.25 }}
              onClick={() => logout().then(() => navigate('/login'))}
            >
              End Demo &amp; Sign Out
            </Button>
          </Alert>
        )}
        <Box sx={{ p: { xs: 2, sm: 3 }, pb: { xs: '80px', md: 3 } }}>
          <Outlet />
        </Box>
      </Box>

      {/* Mobile bottom navigation */}
      <Paper
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: theme.zIndex.appBar,
          borderTop: '1px solid',
          borderColor: 'divider',
          backdropFilter: 'blur(20px) saturate(180%)',
          bgcolor: isDark ? alpha('#1c1c1e', 0.85) : alpha('#ffffff', 0.85),
        }}
        elevation={0}
      >
        <BottomNavigation
          value={activeTab >= 0 ? activeTab : false}
          onChange={(_, newValue) => navigate(NAV_ITEMS[newValue].path)}
          sx={{
            bgcolor: 'transparent',
            height: 60,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 0,
              color: 'text.secondary',
              '&.Mui-selected': {
                color: 'primary.main',
              },
            },
            '& .MuiBottomNavigationAction-label': {
              fontSize: '10px !important',
              fontWeight: 600,
              '&.Mui-selected': {
                fontSize: '10px !important',
              },
            },
          }}
        >
          {NAV_ITEMS.map(({ label, path, icon: Icon }) => (
            <BottomNavigationAction
              key={label}
              label={label}
              showLabel
              icon={
                <Box sx={{ position: 'relative', lineHeight: 0 }}>
                  <Icon sx={{ fontSize: 22 }} />
                  {busyPaths[path] && (
                    <Box sx={{
                      position: 'absolute', top: -2, right: -2,
                      width: 7, height: 7, borderRadius: '50%',
                      bgcolor: 'warning.main',
                      animation: 'pulse 1.4s ease-in-out infinite',
                      '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
                    }} />
                  )}
                </Box>
              }
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  )
}
