import { createFileRoute } from '@tanstack/react-router'
import { useAuthStore } from '@mochi/common'
import { WikiLayout } from '@/components/layout/wiki-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    // Initialize auth state from cookies if available
    // but don't redirect to login if not authenticated (allow anonymous access)
    const store = useAuthStore.getState()
    const token = store.token

    if (!token) {
      // Redirect to login if no token
      const returnUrl = encodeURIComponent(location.href)
      const loginUrl = (import.meta as any).env.VITE_AUTH_LOGIN_URL || '/login'
      const redirectUrl = `${loginUrl}?redirect=${returnUrl}`

      window.location.href = redirectUrl
      return
    }

    return
  },
  component: WikiLayout,
})
