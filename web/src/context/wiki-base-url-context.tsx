import { createContext, useContext, type ReactNode } from 'react'
import type { WikiPermissions } from '@/types/wiki'

interface WikiInfo {
  id: string
  name: string
  home: string
  fingerprint?: string
}

interface WikiBaseURLContextValue {
  baseURL: string
  wiki: WikiInfo
  permissions: WikiPermissions
}

const WikiBaseURLContext = createContext<WikiBaseURLContextValue | null>(null)

interface WikiBaseURLProviderProps {
  baseURL: string
  wiki: WikiInfo
  permissions: WikiPermissions
  children: ReactNode
}

export function WikiBaseURLProvider({ baseURL, wiki, permissions, children }: WikiBaseURLProviderProps) {
  return (
    <WikiBaseURLContext.Provider value={{ baseURL, wiki, permissions }}>
      {children}
    </WikiBaseURLContext.Provider>
  )
}

export function useWikiBaseURL(): WikiBaseURLContextValue {
  const context = useContext(WikiBaseURLContext)
  if (!context) {
    throw new Error('useWikiBaseURL must be used within WikiBaseURLProvider')
  }
  return context
}

export function useWikiBaseURLOptional(): WikiBaseURLContextValue | null {
  return useContext(WikiBaseURLContext)
}
