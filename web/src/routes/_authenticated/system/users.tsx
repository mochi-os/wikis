import { createFileRoute } from '@tanstack/react-router'
import { SystemUsers } from '@/features/system/users'

export const Route = createFileRoute('/_authenticated/system/users')({
  component: SystemUsers,
})
