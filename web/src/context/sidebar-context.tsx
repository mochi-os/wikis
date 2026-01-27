import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

type SidebarContextValue = {
  // setPage is kept for backwards compatibility but is now a no-op
  // (was used for tree expansion, no longer needed with flat sidebar)
  setPage: (slug: string | null, title?: string) => void
  bookmarkDialogOpen: boolean
  openBookmarkDialog: () => void
  closeBookmarkDialog: () => void
  searchDialogOpen: boolean
  openSearchDialog: () => void
  closeSearchDialog: () => void
  createDialogOpen: boolean
  openCreateDialog: () => void
  closeCreateDialog: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false)
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  // No-op function for backwards compatibility
  const setPage = useCallback((_slug: string | null, _title?: string) => {}, [])

  const openBookmarkDialog = useCallback(() => {
    setBookmarkDialogOpen(true)
  }, [])

  const closeBookmarkDialog = useCallback(() => {
    setBookmarkDialogOpen(false)
  }, [])

  const openSearchDialog = useCallback(() => {
    setSearchDialogOpen(true)
  }, [])

  const closeSearchDialog = useCallback(() => {
    setSearchDialogOpen(false)
  }, [])

  const openCreateDialog = useCallback(() => {
    setCreateDialogOpen(true)
  }, [])

  const closeCreateDialog = useCallback(() => {
    setCreateDialogOpen(false)
  }, [])

  return (
    <SidebarContext.Provider value={{
      setPage,
      bookmarkDialogOpen,
      openBookmarkDialog,
      closeBookmarkDialog,
      searchDialogOpen,
      openSearchDialog,
      closeSearchDialog,
      createDialogOpen,
      openCreateDialog,
      closeCreateDialog,
    }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebarContext() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebarContext must be used within a SidebarProvider')
  }
  return context
}
