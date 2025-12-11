import { createFileRoute } from '@tanstack/react-router'
import { UserSessions } from '@/features/user/sessions'

export const Route = createFileRoute('/_authenticated/user/sessions')({
  component: UserSessions,
})
