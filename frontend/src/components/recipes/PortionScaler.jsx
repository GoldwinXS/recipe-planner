import { Box, IconButton, Typography, TextField } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import PeopleIcon from '@mui/icons-material/People'

export default function PortionScaler({ baseServings, targetServings, onChange }) {
  const handleDecrement = () => {
    if (targetServings > 1) {
      onChange(targetServings - 1)
    }
  }

  const handleIncrement = () => {
    onChange(targetServings + 1)
  }

  const handleInput = (e) => {
    const val = parseInt(e.target.value, 10)
    if (!isNaN(val) && val >= 1) {
      onChange(val)
    }
  }

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        px: 1.5,
        py: 0.5,
      }}
    >
      <PeopleIcon color="primary" fontSize="small" />
      <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
        Servings:
      </Typography>
      <IconButton size="small" onClick={handleDecrement} disabled={targetServings <= 1}>
        <RemoveIcon fontSize="small" />
      </IconButton>
      <TextField
        value={targetServings}
        onChange={handleInput}
        size="small"
        inputProps={{
          min: 1,
          style: { width: 40, textAlign: 'center', padding: '2px 4px' },
          type: 'number',
        }}
        sx={{ '& .MuiOutlinedInput-notchedOutline': { border: 'none' } }}
      />
      <IconButton size="small" onClick={handleIncrement}>
        <AddIcon fontSize="small" />
      </IconButton>
      {baseServings !== targetServings && (
        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
          (base: {baseServings})
        </Typography>
      )}
    </Box>
  )
}
