import {
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Typography,
} from '@mui/material'

export default function ShoppingItem({ item, onToggle }) {
  const label = item.ingredient?.name || item.ingredient_name || 'Unknown item'
  const qty = item.total_quantity ?? item.quantity
  const unit = item.unit || ''
  const secondary = [qty, unit].filter(Boolean).join(' ')

  return (
    <ListItem
      dense
      sx={{
        borderRadius: 1,
        mb: 0.25,
        opacity: item.checked ? 0.45 : 1,
        transition: 'opacity 0.2s',
        '&:hover': { bgcolor: 'action.hover' },
        pl: 1,
      }}
    >
      <ListItemIcon sx={{ minWidth: 36 }}>
        <Checkbox
          edge="start"
          checked={!!item.checked}
          onChange={() => onToggle(item.id)}
          size="small"
          color="primary"
        />
      </ListItemIcon>
      <ListItemText
        primary={
          <Typography
            variant="body2"
            sx={{
              textDecoration: item.checked ? 'line-through' : 'none',
              fontWeight: 500,
            }}
          >
            {label}
          </Typography>
        }
        secondary={secondary || null}
      />
    </ListItem>
  )
}
