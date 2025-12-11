import { createFileRoute } from '@tanstack/react-router'
import { UserPreferences } from '@/features/user/preferences'

export const Route = createFileRoute('/_authenticated/user/preferences')({
  component: UserPreferences,
})
