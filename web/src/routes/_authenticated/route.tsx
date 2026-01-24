import { createFileRoute } from '@tanstack/react-router'
import { useAuthStore } from '@mochi/common'
import { WikiLayout } from '@/components/layout/wiki-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: () => {
    // Initialize auth state from cookies if available
    // but don't redirect to login if not authenticated (allow anonymous access)
    const store = useAuthStore.getState()

    if (!store.isInitialized) {
      store.initialize()
    }

    return
  },
  component: WikiLayout,
})
