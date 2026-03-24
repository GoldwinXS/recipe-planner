import { useState } from 'react'
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom'
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Link,
  InputAdornment,
  IconButton,
  Divider,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu'
import useAuth from '../hooks/useAuth'
import ErrorAlert from '../components/common/ErrorAlert'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { login, demoLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = location.state?.from?.pathname || '/dashboard'

  const handleDemo = async () => {
    setError(null)
    setLoading(true)
    try {
      await demoLogin()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login({ username, password })
      navigate(from, { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Card sx={{ maxWidth: 420, width: '100%' }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <RestaurantMenuIcon color="primary" sx={{ fontSize: 48 }} />
            <Typography variant="h5" fontWeight={700} mt={1}>
              Recipe Planner
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Sign in to your account
            </Typography>
          </Box>

          <ErrorAlert error={error} onClose={() => setError(null)} />

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              fullWidth
              required
              autoFocus
              autoComplete="username"
              margin="normal"
            />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              autoComplete="current-password"
              margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword((v) => !v)} edge="end" size="small">
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{ mt: 2, mb: 1.5 }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Box>

          <Divider sx={{ my: 2 }}>or</Divider>

          <Button
            variant="outlined"
            fullWidth
            size="large"
            onClick={handleDemo}
            disabled={loading}
            sx={{ mb: 2 }}
          >
            Try Demo Account
          </Button>

          <Typography variant="body2" textAlign="center" color="text.secondary">
            Don&apos;t have an account?{' '}
            <Link component={RouterLink} to="/register" fontWeight={600}>
              Create one
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
