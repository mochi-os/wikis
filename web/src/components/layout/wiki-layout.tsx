import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import {
  AuthenticatedLayout,
  getErrorMessage,
  requestHelpers,
  type SidebarData,
  type NavItem,
  toast,
  SearchEntityDialog,
  CreateEntityDialog,
  type CreateEntityValues,
} from '@mochi/common'
import {
  BookOpen,
  Library,
  Plus,
  Search,
} from 'lucide-react'
import endpoints from '@/api/endpoints'
import { SidebarProvider, useSidebarContext } from '@/context/sidebar-context'
import { WikiProvider, useWikiContext } from '@/context/wiki-context'
import { useJoinWiki, useCreateWiki } from '@/hooks/use-wiki'

interface RecommendedWiki {
  id: string
  name: string
  blurb: string
  fingerprint: string
}

interface RecommendationsResponse {
  wikis: RecommendedWiki[]
}

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
    searchDialogOpen,
    openSearchDialog,
    closeSearchDialog,
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
  const joinWiki = useJoinWiki()
  const createWiki = useCreateWiki()

  // Recommendations query
  const {
    data: recommendationsData,
    isLoading: isLoadingRecommendations,
    isError: isRecommendationsError,
  } = useQuery({
    queryKey: ['wikis', 'recommendations'],
    queryFn: () => requestHelpers.get<RecommendationsResponse>(`/wikis/${endpoints.wiki.recommendations}`),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const recommendations = recommendationsData?.wikis ?? []

  // Set of owned/joined wiki IDs for search dialog (includes source for joined wikis)
  const subscribedWikiIds = useMemo(
    () => new Set(
      (info?.wikis || []).flatMap((w) => [w.id, w.fingerprint, w.source].filter((x): x is string => !!x))
    ),
    [info?.wikis]
  )

  const handleSearchSubscribe = async (wikiId: string, entity?: { location?: string; fingerprint?: string }) => {
    return new Promise<void>((resolve, reject) => {
      const onSuccess = (data: { fingerprint: string; home: string }) => {
        closeSearchDialog()
        // Navigate to the wiki using fingerprint from join response for shorter URLs
        navigate({ to: '/$wikiId/$page', params: { wikiId: data.fingerprint, page: data.home } })
        resolve()
      }

      // Try with server location first, retry without if connection fails
      joinWiki.mutate({ target: wikiId, server: entity?.location || undefined }, {
        onSuccess,
        onError: (error) => {
          // If server connection failed (502) and we had a server, retry without it
          const status = (error as { status?: number })?.status
          if (status === 502 && entity?.location) {
            joinWiki.mutate({ target: wikiId }, {
              onSuccess,
              onError: reject,
            })
          } else {
            reject(error)
          }
        },
      })
    })
  }

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
          { title: 'Find wikis', icon: Search, onClick: openSearchDialog },
          { title: 'Create wiki', icon: Plus, onClick: openCreateDialog },
        ],
      },
    ]

    return { navGroups: groups }
  }, [isInWiki, wikiName, info, urlEntityId, handleAllWikisClick, openSearchDialog, openCreateDialog, location.pathname])

  return (
    <>
      <AuthenticatedLayout sidebarData={sidebarData} />

      {/* Search wiki dialog */}
      <SearchEntityDialog
        open={searchDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeSearchDialog()
        }}
        onSubscribe={handleSearchSubscribe}
        subscribedIds={subscribedWikiIds}
        entityClass="wiki"
        searchEndpoint="/wikis/directory/search"
        icon={BookOpen}
        iconClassName="bg-emerald-500/10 text-emerald-600"
        title="Find wikis"
        placeholder="Search by name, ID, fingerprint, or URL..."
        emptyMessage="No wikis found"
        recommendations={recommendations}
        isLoadingRecommendations={isLoadingRecommendations}
        isRecommendationsError={isRecommendationsError}
      />

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
