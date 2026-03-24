import { createContext, useContext, useMemo, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { buildTheme } from './theme'
import { WebLLMProvider } from './contexts/WebLLMContext'
import AppShell from './components/layout/AppShell'
import ProtectedRoute from './components/common/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Cookbook from './pages/Cookbook'
import RecipeDetail from './pages/RecipeDetail'
import RecipeForm from './pages/RecipeForm'
import ClaudeGenerator from './pages/ClaudeGenerator'
import MealPlanner from './pages/MealPlanner'
import ShoppingList from './pages/ShoppingList'
import Account from './pages/Account'

export const ColorModeContext = createContext({ toggleColorMode: () => {}, mode: 'light' })
export function useColorMode() { return useContext(ColorModeContext) }

function getInitialMode() {
  const stored = localStorage.getItem('color-mode')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [mode, setMode] = useState(getInitialMode)

  useEffect(() => {
    localStorage.setItem('color-mode', mode)
  }, [mode])

  const colorMode = useMemo(() => ({
    mode,
    toggleColorMode: () => setMode((m) => (m === 'light' ? 'dark' : 'light')),
  }), [mode])

  const theme = useMemo(() => buildTheme(mode), [mode])

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <WebLLMProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/cookbook" element={<Cookbook />} />
              <Route path="/cookbook/new" element={<RecipeForm />} />
              <Route path="/cookbook/:id" element={<RecipeDetail />} />
              <Route path="/cookbook/:id/edit" element={<RecipeForm />} />
              <Route path="/generate" element={<ClaudeGenerator />} />
              <Route path="/meal-planner" element={<MealPlanner />} />
              <Route path="/shopping" element={<ShoppingList />} />
              <Route path="/account" element={<Account />} />
            </Route>
          </Routes>
        </BrowserRouter>
        </WebLLMProvider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}
