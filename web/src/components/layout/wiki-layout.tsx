import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import {
  AuthenticatedLayout,
  getErrorMessage,
  type SidebarData,
  type NavItem,
  toast,
  CreateEntityDialog,
  type CreateEntityValues,
} from '@mochi/common'
import {
  BookOpen,
  Library,
  Plus,
  Search,
} from 'lucide-react'
import { SidebarProvider, useSidebarContext } from '@/context/sidebar-context'
import { WikiProvider, useWikiContext } from '@/context/wiki-context'
import { useCreateWiki } from '@/hooks/use-wiki'

// Check if a string looks like an entity ID (9-char fingerprint or 50-51 char full ID)
const ENTITY_ID_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{9}$|^[1-9A-HJ-NP-Za-km-z]{50,51}$/

// Extract entity ID from pathname
// URL pattern: /<app>/<entity>/<page> or /<entity>/<page> in entity context
function getEntityIdFromPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean)
  for (const segment of segments.slice(0, 2)) {
    if (ENTITY_ID_PATTERN.test(segment)) {
      return segment
    }
  }
  return null
}

function WikiLayoutInner() {
  const {
    createDialogOpen,
    openCreateDialog,
    closeCreateDialog,
  } = useSidebarContext()
  const { info } = useWikiContext()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Handle "All wikis" click - navigate and refresh the list
  const handleAllWikisClick = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['wiki', 'info'] })
    navigate({ to: '/' })
  }, [queryClient, navigate])
  const createWiki = useCreateWiki()

  // Use router location for reactive URL changes
  const location = useLocation()
  const urlEntityId = getEntityIdFromPath(location.pathname)

  // Whether we're inside a specific wiki - use URL as source of truth
  const isInWiki = urlEntityId !== null
  const wikiName = info?.wiki?.name

  const handleCreateWiki = async (values: CreateEntityValues) => {
    return new Promise<void>((resolve, reject) => {
      createWiki.mutate(
        { name: values.name, privacy: values.privacy },
        {
          onSuccess: (data) => {
            toast.success('Wiki created')
            closeCreateDialog()
            const wikiId = data.fingerprint ?? data.id
            navigate({ to: '/$wikiId/$page', params: { wikiId, page: data.home } })
            resolve()
          },
          onError: (error) => {
            toast.error(getErrorMessage(error, 'Failed to create wiki'))
            reject(error)
          },
        }
      )
    })
  }

  const sidebarData: SidebarData = useMemo(() => {
    // Get current wiki ID for highlighting - use URL as source of truth
    // If urlEntityId is null, we're not in a wiki (e.g., at "All wikis")
    const currentWikiId = urlEntityId

    // Build wiki items sorted alphabetically
    const wikiItems: NavItem[] = [...(info?.wikis || [])]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      .map((wiki) => ({
        title: wiki.name,
        url: `/${wiki.fingerprint ?? wiki.id}/${wiki.home}` as const,
        icon: BookOpen,
        isActive: wiki.id === currentWikiId || wiki.fingerprint === currentWikiId,
      }))

    // Build current wiki item when in entity context but not in the wikis list
    // (This handles when we're viewing a wiki that might not be in our class list)
    const currentWikiInList = info?.wikis?.some(w => w.id === currentWikiId || w.fingerprint === currentWikiId)
    const standaloneWikiUrl = info?.wiki?.fingerprint ?? info?.wiki?.id ?? urlEntityId
    const standaloneWikiHome = info?.wiki?.home || 'home'
    const standaloneWikiItem = isInWiki && !currentWikiInList && standaloneWikiUrl ? {
      title: wikiName || 'Wiki',
      url: `/${standaloneWikiUrl}/${standaloneWikiHome}` as const,
      icon: BookOpen,
      isActive: true,
    } : null

    // "All wikis" is now a simple link without submenu
    const allWikisItem = {
      title: 'All wikis',
      onClick: handleAllWikisClick,
      icon: Library,
      isActive: location.pathname === '/',
    }

    const groups: SidebarData['navGroups'] = [
      {
        title: '',
        items: [
          allWikisItem,
          ...wikiItems,
          ...(standaloneWikiItem ? [standaloneWikiItem] : []),
        ],
      },
      {
        title: '',
        separator: true,
        items: [
          { title: 'Find wikis', icon: Search, url: '/find' },
          { title: 'Create wiki', icon: Plus, onClick: openCreateDialog },
        ],
      },
    ]

    return { navGroups: groups }
  }, [isInWiki, wikiName, info, urlEntityId, handleAllWikisClick, openCreateDialog, location.pathname])

  return (
    <>
      <AuthenticatedLayout sidebarData={sidebarData} />

      {/* Create wiki dialog */}
      <CreateEntityDialog
        open={createDialogOpen}
        onOpenChange={(open) => { if (!open) closeCreateDialog() }}
        icon={BookOpen}
        title="Create wiki"
        entityLabel="Wiki"
        showPrivacyToggle
        privacyLabel="Allow anyone to search for wiki"
        onSubmit={handleCreateWiki}
        isPending={createWiki.isPending}
        hideTrigger
      />
    </>
  )
}

export function WikiLayout() {
  return (
    <WikiProvider>
      <SidebarProvider>
        <WikiLayoutInner />
      </SidebarProvider>
    </WikiProvider>
  )
}
