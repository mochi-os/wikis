import { createFileRoute } from '@tanstack/react-router'

import { WikiLayout } from '@/components/layout/wiki-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    // allow anonymous access
    return
  },
  component: WikiLayout,
})
