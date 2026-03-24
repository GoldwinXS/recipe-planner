import { List, ListSubheader, Divider, Box } from '@mui/material'
import ShoppingItem from './ShoppingItem'

const CATEGORY_LABELS = {
  protein: 'Protein',
  carb: 'Carbohydrates',
  vegetable: 'Vegetables',
  dairy: 'Dairy',
  spice: 'Spices & Herbs',
  other: 'Other',
}

export default function ShoppingGroup({ category, items, onToggle }) {
  if (!items || items.length === 0) return null

  const label = CATEGORY_LABELS[category] || category.charAt(0).toUpperCase() + category.slice(1)

  return (
    <Box sx={{ mb: 1.5 }}>
      <List
        subheader={
          <ListSubheader
            sx={{
              bgcolor: 'background.default',
              fontWeight: 700,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              lineHeight: '32px',
              color: 'text.secondary',
            }}
          >
            {label}
          </ListSubheader>
        }
        dense
        disablePadding
      >
        {items.map((item) => (
          <ShoppingItem key={item.id} item={item} onToggle={onToggle} />
        ))}
      </List>
      <Divider sx={{ mt: 0.5 }} />
    </Box>
  )
}
