import { createFileRoute } from '@tanstack/react-router'
import { useAuthStore } from '@mochi/common'
import { WikiLayout } from '@/components/layout/wiki-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location, redirect }) => {
    // Initialize auth state from cookies if available
    // but don't redirect to login if not authenticated (allow anonymous access)
    const store = useAuthStore.getState()
    const token = store.token

    if (!token) {
      throw redirect({
        to: (import.meta as any).env.VITE_AUTH_LOGIN_URL || '/login',
        search: {
          redirect: location.href,
        },
      })
    }

    return
  },
  component: WikiLayout,
})
