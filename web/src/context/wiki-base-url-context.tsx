// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { createContext, useContext, type ReactNode } from 'react'
import type { WikiPermissions } from '@/types/wiki'

interface WikiInfo {
  id: string
  name: string
  home: string
  fingerprint?: string
  source?: string
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
