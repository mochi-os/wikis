import { useCallback, useMemo } from 'react'
import { useLingui } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import {
  AuthenticatedLayout,
  getErrorMessage,
  type SidebarData,
  type NavItem,
  type NavCollapsible,
  toast,
  CreateEntityDialog,
  type CreateEntityValues, naturalCompare,} from '@mochi/web'
import {
  BookOpen,
  Library,
  Plus,
  Search,
} from 'lucide-react'
import { SidebarProvider, useSidebarContext } from '@/context/sidebar-context'
import { WikiProvider, useWikiContext } from '@/context/wiki-context'
import { useCreateWiki, useWikiPages } from '@/hooks/use-wiki'

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
  const { t } = useLingui()
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

  // Fetch page list for the currently active wiki (for sidebar tree)
  const { data: pagesData } = useWikiPages(urlEntityId ?? undefined)
  const activeWikiPages = pagesData?.pages ?? []

  const handleCreateWiki = async (values: CreateEntityValues) => {
    return new Promise<void>((resolve, reject) => {
      createWiki.mutate(
        { name: values.name, privacy: values.privacy },
        {
          onSuccess: (data) => {
            toast.success(t`Wiki created`)
            closeCreateDialog()
            const wikiId = data.fingerprint ?? data.id
            navigate({ to: '/$wikiId/$page', params: { wikiId, page: data.home } })
            resolve()
          },
          onError: (error) => {
            toast.error(getErrorMessage(error, t`Failed to create wiki`))
            reject(error)
          },
        }
      )
    })
  }

  const sidebarData: SidebarData = useMemo(() => {
    // Get current wiki ID for highlighting - use URL as source of truth
    const currentWikiId = urlEntityId

    // Build wiki items as NavCollapsible with pages as children for the active wiki
    const wikiItems: NavItem[] = [...(info?.wikis || [])]
      .sort((a, b) => naturalCompare(a.name, b.name))
      .map((wiki): NavCollapsible => {
        const isActive = wiki.id === currentWikiId || wiki.fingerprint === currentWikiId
        const pages = isActive ? activeWikiPages.slice(0, 50) : []
        return {
          title: wiki.name,
          url: `/${wiki.fingerprint ?? wiki.id}/${wiki.home}` as const,
          icon: BookOpen,
          open: isActive ? true : undefined,
          items: pages.map((p) => ({
            title: p.title,
            url: `/${wiki.fingerprint ?? wiki.id}/${p.page}` as const,
          })),
        }
      })

    // Build current wiki item when in entity context but not in the wikis list
    const currentWikiInList = info?.wikis?.some(w => w.id === currentWikiId || w.fingerprint === currentWikiId)
    const standaloneWikiUrl = info?.wiki?.fingerprint ?? info?.wiki?.id ?? urlEntityId
    const standaloneWikiHome = info?.wiki?.home || 'home'
    const standaloneWikiItem: NavCollapsible | null = isInWiki && !currentWikiInList && standaloneWikiUrl ? {
      title: wikiName || t`Wiki`,
      url: `/${standaloneWikiUrl}/${standaloneWikiHome}` as const,
      icon: BookOpen,
      open: true,
      items: activeWikiPages.slice(0, 50).map((p) => ({
        title: p.title,
        url: `/${standaloneWikiUrl}/${p.page}` as const,
      })),
    } : null

    // "All wikis" is now a simple link without submenu
    const allWikisItem = {
      title: t`All wikis`,
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
          { title: t`Find wikis`, icon: Search, url: '/find' },
          { title: t`Create wiki`, icon: Plus, onClick: openCreateDialog },
        ],
      },
    ]

    return { navGroups: groups }
  }, [isInWiki, wikiName, info, urlEntityId, activeWikiPages, handleAllWikisClick, openCreateDialog, location.pathname, t])

  return (
    <>
      <AuthenticatedLayout
        sidebarData={sidebarData}
        usePageHeaderForMobileNav
      />

      {/* Create wiki dialog */}
      <CreateEntityDialog
        open={createDialogOpen}
        onOpenChange={(open) => { if (!open) closeCreateDialog() }}
        icon={BookOpen}
        title={t`Create wiki`}
        entityLabel={t`Wiki`}
        showPrivacyToggle
        privacyLabel={t`Allow anyone to search for wiki`}
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
