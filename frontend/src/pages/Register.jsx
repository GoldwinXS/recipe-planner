import { useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
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
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu'
import useAuth from '../hooks/useAuth'
import ErrorAlert from '../components/common/ErrorAlert'

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '', password_confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (form.password !== form.password_confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await register(form)
      navigate('/dashboard', { replace: true })
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
              Create Account
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Start planning your meals today
            </Typography>
          </Box>

          <ErrorAlert error={error} onClose={() => setError(null)} />

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              label="Username"
              value={form.username}
              onChange={handleChange('username')}
              fullWidth
              required
              autoFocus
              autoComplete="username"
              margin="normal"
              inputProps={{ minLength: 3, maxLength: 30 }}
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              fullWidth
              required
              autoComplete="email"
              margin="normal"
            />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={handleChange('password')}
              fullWidth
              required
              autoComplete="new-password"
              margin="normal"
              helperText="Minimum 8 characters"
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
            <TextField
              label="Confirm Password"
              type={showPassword ? 'text' : 'password'}
              value={form.password_confirm}
              onChange={handleChange('password_confirm')}
              fullWidth
              required
              autoComplete="new-password"
              margin="normal"
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{ mt: 2, mb: 1.5 }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </Box>

          <Typography variant="body2" textAlign="center" color="text.secondary">
            Already have an account?{' '}
            <Link component={RouterLink} to="/login" fontWeight={600}>
              Sign in
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
