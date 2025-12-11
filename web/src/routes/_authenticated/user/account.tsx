import { createFileRoute } from '@tanstack/react-router'
import { UserAccount } from '@/features/user/account'

export const Route = createFileRoute('/_authenticated/user/account')({
  component: UserAccount,
})
