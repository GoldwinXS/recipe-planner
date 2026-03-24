import { Alert, AlertTitle, Collapse } from '@mui/material'

export default function ErrorAlert({ error, onClose, title = 'Error' }) {
  if (!error) return null

  const message =
    typeof error === 'string'
      ? error
      : error.userMessage || error.message || 'An unexpected error occurred.'

  return (
    <Collapse in={!!error}>
      <Alert severity="error" onClose={onClose} sx={{ mb: 2 }}>
        {title && <AlertTitle>{title}</AlertTitle>}
        {message}
      </Alert>
    </Collapse>
  )
}
