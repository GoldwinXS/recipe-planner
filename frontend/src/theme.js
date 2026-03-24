import { createTheme, alpha } from '@mui/material/styles'

export function buildTheme(mode) {
  const isDark = mode === 'dark'

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#2a7d4f',
        light: '#4caf7d',
        dark: '#1a5235',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#f59e0b',
        light: '#fbbf24',
        dark: '#d97706',
        contrastText: '#000000',
      },
      background: {
        default: isDark ? '#111114' : '#f2f2f7',
        paper: isDark ? '#1c1c1e' : '#ffffff',
      },
      success: { main: isDark ? '#4ade80' : '#16a34a' },
      error: { main: isDark ? '#f87171' : '#dc2626' },
      warning: { main: isDark ? '#fbbf24' : '#d97706' },
      divider: isDark ? alpha('#ffffff', 0.08) : alpha('#000000', 0.08),
      text: {
        primary: isDark ? '#f2f2f7' : '#1c1c1e',
        secondary: isDark ? alpha('#f2f2f7', 0.55) : alpha('#1c1c1e', 0.5),
        disabled: isDark ? alpha('#f2f2f7', 0.28) : alpha('#1c1c1e', 0.26),
      },
    },
    typography: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h1: { fontWeight: 800, letterSpacing: '-0.025em' },
      h2: { fontWeight: 800, letterSpacing: '-0.02em' },
      h3: { fontWeight: 800, letterSpacing: '-0.02em' },
      h4: { fontWeight: 700, letterSpacing: '-0.015em' },
      h5: { fontWeight: 700, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600, letterSpacing: '-0.005em' },
      subtitle1: { fontWeight: 600 },
      button: { fontWeight: 600, letterSpacing: 0 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 99,
          },
          contained: {
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            boxShadow: isDark
              ? '0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)'
              : '0 1px 3px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.05)',
            transition: 'box-shadow 0.2s ease, transform 0.2s ease',
            '&:hover': {
              boxShadow: isDark
                ? '0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)'
                : '0 8px 24px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.07)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: {
            borderColor: isDark ? alpha('#ffffff', 0.08) : alpha('#000000', 0.08),
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 500, borderRadius: 99 },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 12,
              '& fieldset': {
                borderColor: isDark ? alpha('#ffffff', 0.1) : alpha('#000000', 0.12),
              },
              '&:hover fieldset': {
                borderColor: isDark ? alpha('#ffffff', 0.2) : alpha('#000000', 0.24),
              },
            },
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: { borderRadius: 12 },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: { borderRadius: 10 },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: isDark
              ? alpha('#1c1c1e', 0.92)
              : alpha('#f2f2f7', 0.92),
            backdropFilter: 'blur(20px) saturate(180%)',
            borderRight: `1px solid ${isDark ? alpha('#ffffff', 0.07) : alpha('#000000', 0.07)}`,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: isDark
              ? alpha('#111114', 0.85)
              : alpha('#f2f2f7', 0.85),
            backdropFilter: 'blur(20px) saturate(180%)',
            color: isDark ? '#f2f2f7' : '#1c1c1e',
            borderBottom: `1px solid ${isDark ? alpha('#ffffff', 0.07) : alpha('#000000', 0.07)}`,
            boxShadow: 'none',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 20,
            backgroundImage: 'none',
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 12 },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 99 },
        },
      },
    },
  })
}
