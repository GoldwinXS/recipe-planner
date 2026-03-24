import { Box, CircularProgress } from '@mui/material'

export default function LoadingSpinner({ size = 48, minHeight = '60vh' }) {
  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minHeight={minHeight}
      width="100%"
    >
      <CircularProgress size={size} color="primary" />
    </Box>
  )
}
