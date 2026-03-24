import { Grid, Typography, Box } from '@mui/material'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import RecipeCard from './RecipeCard'
import LoadingSpinner from '../common/LoadingSpinner'

export default function RecipeGrid({ recipes, loading, selectable = false, selectedIds = [], onToggleSelect }) {
  if (loading) {
    return <LoadingSpinner minHeight="40vh" />
  }

  if (!recipes || recipes.length === 0) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="40vh"
        gap={2}
        color="text.secondary"
      >
        <MenuBookIcon sx={{ fontSize: 64, opacity: 0.3 }} />
        <Typography variant="h6" color="text.secondary">
          No recipes found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Add a recipe or generate one with Claude AI
        </Typography>
      </Box>
    )
  }

  return (
    <Grid container spacing={2}>
      {recipes.map((recipe) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={recipe.id} sx={{ position: 'relative' }}>
          <RecipeCard
            recipe={recipe}
            selectable={selectable}
            selected={selectedIds.includes(recipe.id)}
            onSelect={onToggleSelect}
          />
        </Grid>
      ))}
    </Grid>
  )
}
