import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Stack,
  TextField,
  Button,
  Divider,
  Avatar,
  Alert,
  Chip,
  Grid,
} from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'
import LockIcon from '@mui/icons-material/Lock'
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import useAuth from '../hooks/useAuth'
import { updateProfile, getProfile } from '../api/auth'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Account() {
  const { user, updateUser } = useAuth()

  // Profile form
  const [profile, setProfile] = useState({ username: user?.username || '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError, setProfileError] = useState(null)

  // Password form
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm: '' })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState(null)

  // Nutrition goals
  const [goals, setGoals] = useState({
    daily_calorie_goal: '',
    daily_protein_g: '',
    daily_carbs_g: '',
    daily_fat_g: '',
    cooking_days: [6],
  })
  const [goalsSaving, setGoalsSaving] = useState(false)
  const [goalsSuccess, setGoalsSuccess] = useState(false)
  const [goalsError, setGoalsError] = useState(null)

  // Load full profile (includes goals + cooking_days)
  useEffect(() => {
    getProfile().then((res) => {
      const d = res.data
      setGoals({
        daily_calorie_goal: d.daily_calorie_goal ?? '',
        daily_protein_g: d.daily_protein_g ?? '',
        daily_carbs_g: d.daily_carbs_g ?? '',
        daily_fat_g: d.daily_fat_g ?? '',
        cooking_days: d.cooking_days?.length ? d.cooking_days : [6],
      })
    }).catch(() => {})
  }, [])

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setProfileSaving(true)
    setProfileSuccess(false)
    setProfileError(null)
    try {
      const res = await updateProfile({ username: profile.username })
      updateUser({ username: res.data.username, email: res.data.email })
      setProfileSuccess(true)
    } catch (err) {
      const data = err.response?.data
      if (data) {
        const msg = Object.values(data).flat().join(' ')
        setProfileError(msg)
      } else {
        setProfileError('Failed to update profile.')
      }
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePasswordSave = async (e) => {
    e.preventDefault()
    setPasswordSaving(true)
    setPasswordSuccess(false)
    setPasswordError(null)
    if (passwords.new_password !== passwords.confirm) {
      setPasswordError('New passwords do not match.')
      setPasswordSaving(false)
      return
    }
    try {
      await updateProfile({
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      })
      setPasswordSuccess(true)
      setPasswords({ current_password: '', new_password: '', confirm: '' })
    } catch (err) {
      const data = err.response?.data
      if (data) {
        const msg = Object.values(data).flat().join(' ')
        setPasswordError(msg)
      } else {
        setPasswordError('Failed to change password.')
      }
    } finally {
      setPasswordSaving(false)
    }
  }

  const toggleCookingDay = (dayIndex) => {
    setGoals((prev) => {
      const days = prev.cooking_days.includes(dayIndex)
        ? prev.cooking_days.filter((d) => d !== dayIndex)
        : [...prev.cooking_days, dayIndex].sort((a, b) => a - b)
      return { ...prev, cooking_days: days }
    })
  }

  const handleGoalsSave = async (e) => {
    e.preventDefault()
    setGoalsSaving(true)
    setGoalsSuccess(false)
    setGoalsError(null)
    try {
      const payload = {
        cooking_days: goals.cooking_days,
        daily_calorie_goal: goals.daily_calorie_goal !== '' ? Number(goals.daily_calorie_goal) : null,
        daily_protein_g: goals.daily_protein_g !== '' ? Number(goals.daily_protein_g) : null,
        daily_carbs_g: goals.daily_carbs_g !== '' ? Number(goals.daily_carbs_g) : null,
        daily_fat_g: goals.daily_fat_g !== '' ? Number(goals.daily_fat_g) : null,
      }
      const res = await updateProfile(payload)
      updateUser({
        cooking_days: res.data.cooking_days,
        daily_calorie_goal: res.data.daily_calorie_goal,
        daily_protein_g: res.data.daily_protein_g,
        daily_carbs_g: res.data.daily_carbs_g,
        daily_fat_g: res.data.daily_fat_g,
      })
      setGoalsSuccess(true)
    } catch (err) {
      const data = err.response?.data
      if (data) {
        const msg = Object.values(data).flat().join(' ')
        setGoalsError(msg)
      } else {
        setGoalsError('Failed to save nutrition goals.')
      }
    } finally {
      setGoalsSaving(false)
    }
  }

  return (
    <Box maxWidth={600} mx="auto">
      <Typography variant="h4" fontWeight={700} mb={3}>
        Account
      </Typography>

      {/* ── Profile ── */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={2}>
          <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.main', fontSize: 20 }}>
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <PersonIcon fontSize="small" /> Profile
            </Typography>
            <Typography variant="caption" color="text.secondary">Update your display name</Typography>
          </Box>
        </Stack>

        <Divider sx={{ mb: 2 }} />

        {profileSuccess && <Alert severity="success" sx={{ mb: 2 }}>Profile updated.</Alert>}
        {profileError && <Alert severity="error" sx={{ mb: 2 }}>{profileError}</Alert>}

        <Box component="form" onSubmit={handleProfileSave}>
          <Stack spacing={2}>
            <TextField
              label="Username"
              value={profile.username}
              onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
              fullWidth
              required
              inputProps={{ maxLength: 150 }}
            />
            <TextField
              label="Email"
              value={user?.email || ''}
              fullWidth
              disabled
              helperText="Email cannot be changed after registration"
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" variant="contained" disabled={profileSaving}>
                {profileSaving ? 'Saving…' : 'Save Profile'}
              </Button>
            </Box>
          </Stack>
        </Box>
      </Paper>

      {/* ── Password ── */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <LockIcon fontSize="small" /> Change Password
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={2}>
          Leave blank to keep your current password
        </Typography>

        <Divider sx={{ mb: 2 }} />

        {passwordSuccess && <Alert severity="success" sx={{ mb: 2 }}>Password changed.</Alert>}
        {passwordError && <Alert severity="error" sx={{ mb: 2 }}>{passwordError}</Alert>}

        <Box component="form" onSubmit={handlePasswordSave}>
          <Stack spacing={2}>
            <TextField
              label="Current Password"
              type="password"
              value={passwords.current_password}
              onChange={(e) => setPasswords((p) => ({ ...p, current_password: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="New Password"
              type="password"
              value={passwords.new_password}
              onChange={(e) => setPasswords((p) => ({ ...p, new_password: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Confirm New Password"
              type="password"
              value={passwords.confirm}
              onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
              fullWidth
              required
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" variant="contained" disabled={passwordSaving}>
                {passwordSaving ? 'Saving…' : 'Change Password'}
              </Button>
            </Box>
          </Stack>
        </Box>
      </Paper>

      {/* ── Nutrition & Meal Planning ── */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <MonitorHeartIcon fontSize="small" /> Nutrition Goals &amp; Meal Planning
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={2}>
          Used by AI meal planning to suggest balanced recipes that hit your targets.
          Leave fields blank to skip any goal.
        </Typography>

        <Divider sx={{ mb: 2 }} />

        {goalsSuccess && <Alert severity="success" sx={{ mb: 2 }}>Goals saved.</Alert>}
        {goalsError && <Alert severity="error" sx={{ mb: 2 }}>{goalsError}</Alert>}

        <Box component="form" onSubmit={handleGoalsSave}>
          <Stack spacing={3}>
            {/* Daily macro targets */}
            <Box>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <RestaurantIcon fontSize="small" /> Daily Macro Targets
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <TextField
                    label="Calories"
                    type="number"
                    value={goals.daily_calorie_goal}
                    onChange={(e) => setGoals((g) => ({ ...g, daily_calorie_goal: e.target.value }))}
                    fullWidth
                    size="small"
                    inputProps={{ min: 0, max: 10000 }}
                    helperText="kcal / day"
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField
                    label="Protein"
                    type="number"
                    value={goals.daily_protein_g}
                    onChange={(e) => setGoals((g) => ({ ...g, daily_protein_g: e.target.value }))}
                    fullWidth
                    size="small"
                    inputProps={{ min: 0, max: 1000, step: 0.1 }}
                    helperText="g / day"
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField
                    label="Carbs"
                    type="number"
                    value={goals.daily_carbs_g}
                    onChange={(e) => setGoals((g) => ({ ...g, daily_carbs_g: e.target.value }))}
                    fullWidth
                    size="small"
                    inputProps={{ min: 0, max: 2000, step: 0.1 }}
                    helperText="g / day"
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField
                    label="Fat"
                    type="number"
                    value={goals.daily_fat_g}
                    onChange={(e) => setGoals((g) => ({ ...g, daily_fat_g: e.target.value }))}
                    fullWidth
                    size="small"
                    inputProps={{ min: 0, max: 1000, step: 0.1 }}
                    helperText="g / day"
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Cooking days */}
            <Box>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Cooking / Prep Days
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                Days you typically cook or batch-prep meals. AI will plan main meals on these days.
              </Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" gap={0.75}>
                {DAY_NAMES.map((name, i) => (
                  <Chip
                    key={i}
                    label={name}
                    onClick={() => toggleCookingDay(i)}
                    color={goals.cooking_days.includes(i) ? 'primary' : 'default'}
                    variant={goals.cooking_days.includes(i) ? 'filled' : 'outlined'}
                    size="small"
                    clickable
                  />
                ))}
              </Stack>
              {goals.cooking_days.length === 0 && (
                <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
                  Select at least one cooking day.
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="contained"
                disabled={goalsSaving || goals.cooking_days.length === 0}
              >
                {goalsSaving ? 'Saving…' : 'Save Goals'}
              </Button>
            </Box>
          </Stack>
        </Box>
      </Paper>
    </Box>
  )
}
