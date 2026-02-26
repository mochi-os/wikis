import { createContext, useContext, type ReactNode } from 'react'
import { useWikiInfo, type WikiInfoResponse } from '@/hooks/use-wiki'
import type { WikiPermissions } from '@/types/wiki'
interface WikiContextValue {
  info: WikiInfoResponse | undefined
  permissions: WikiPermissions
  isLoading: boolean
  error: unknown
  refetch: () => void
}

const defaultPermissions: WikiPermissions = {
  view: false,
  edit: false,
  delete: false,
  manage: false,
}

const WikiContext = createContext<WikiContextValue | null>(null)

export function WikiProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, error, refetch } = useWikiInfo()

  const permissions = data?.permissions ?? defaultPermissions

  return (
    <WikiContext.Provider value={{ info: data, permissions, isLoading, error, refetch }}>
      {children}
    </WikiContext.Provider>
  )
}

export function useWikiContext() {
  const context = useContext(WikiContext)
  if (!context) {
    throw new Error('useWikiContext must be used within WikiProvider')
  }
  return context
}

export function usePermissions(): WikiPermissions {
  const context = useContext(WikiContext)
  return context?.permissions ?? defaultPermissions
}
