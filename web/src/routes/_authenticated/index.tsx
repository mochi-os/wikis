import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import endpoints from '@/api/endpoints'
import { wikisRequest, getRssToken } from '@/api/request'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Main,
  PageHeader as CommonPageHeader,
  toast,
  getErrorMessage,
  isDomainEntityRouting,
} from '@mochi/common'
import { BookOpen, Ellipsis, FileEdit, FilePlus, History, Link2, Loader2, Pencil, Plus, Rss, Search, Settings, Tags } from 'lucide-react'
import { usePageTitle } from '@mochi/common'
import { usePage, useUnsubscribeWiki } from '@/hooks/use-wiki'
import { Header } from '@mochi/common'
import {
  PageView,
  PageNotFound,
  PageViewSkeleton,
} from '@/features/wiki/page-view'
import { PageHeader } from '@/features/wiki/page-header'
import { GeneralError } from '@mochi/common'
import { useSidebarContext } from '@/context/sidebar-context'
import { usePermissions, useWikiContext } from '@/context/wiki-context'
import { cacheWikisList, setLastLocation, getLastLocation, clearLastLocation } from '@/hooks/use-wiki-storage'
import { RenamePageDialog } from '@/features/wiki/rename-page-dialog'
import { InlineWikiSearch } from '@/features/wiki/inline-wiki-search'

interface InfoResponse {
  entity: boolean
  wiki?: { id: string; name: string; home: string; fingerprint?: string }
  wikis?: Array<{ id: string; name: string; home: string; source?: string; fingerprint?: string }>
}

type WikiType = 'owned' | 'subscribed'

interface WikiItem {
  id: string
  name: string
  type: WikiType
  fingerprint?: string
  home: string
}

// Module-level flag to track if we've already done initial redirect check (resets on page refresh)
let hasCheckedRedirect = false

export const Route = createFileRoute('/_authenticated/')({
  loader: async () => {
    const info = await wikisRequest.get<InfoResponse>(endpoints.wiki.info)

    // Cache wikis list for sidebar
    if (info.wikis) {
      cacheWikisList(
        info.wikis.map(w => ({ id: w.id, name: w.name, source: w.source }))
      )
    }

    // Only redirect on first load, not on subsequent navigations
    if (hasCheckedRedirect) {
      return info
    }
    hasCheckedRedirect = true

    // In class context, check for last visited wiki and redirect if it still exists
    if (!info.entity) {
      const lastLocation = getLastLocation()
      if (lastLocation) {
        const allWikis = info.wikis || []
        const wiki = allWikis.find(w => w.id === lastLocation.wikiId || w.fingerprint === lastLocation.wikiId)
        if (wiki) {
          // Use fingerprint for shorter URLs when available
          const wikiId = wiki.fingerprint || wiki.id
          // Get home page slug - wikis have it, bookmarks need to use 'home' as default
          const wikiHome = 'home' in wiki ? wiki.home : 'home'
          const page = lastLocation.pageSlug || wikiHome
          throw redirect({ to: '/$wikiId/$page', params: { wikiId, page } })
        } else {
          clearLastLocation()
        }
      }
    }

    return info
  },
  component: IndexPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

// Check if we're in entity context based on browser URL
// Entity context: first URL segment is an entity ID, or domain-routed entity (e.g. docs.mochi-os.org)
function isEntityContext(): boolean {
  if (isDomainEntityRouting()) return true
  const pathname = window.location.pathname
  const firstSegment = pathname.match(/^\/([^/]+)/)?.[1] || ''
  return /^[1-9A-HJ-NP-Za-km-z]{9}$/.test(firstSegment) ||
    /^[1-9A-HJ-NP-Za-km-z]{50,51}$/.test(firstSegment)
}

function IndexPage() {
  const data = Route.useLoaderData()

  // If we're in entity context (URL starts with entity ID), show the wiki's home page directly
  // Use URL-based detection since API data.entity may be stale
  if (isEntityContext() && data.wiki) {
    return <WikiHomePage wikiId={data.wiki.fingerprint ?? data.wiki.id} homeSlug={data.wiki.home} />
  }

  // Class context - show wikis list
  return <WikisListPage wikis={data.wikis} />
}

function WikiHomePage({ wikiId, homeSlug }: { wikiId: string; homeSlug: string }) {
  const navigate = useNavigate()
  const { data, isLoading, error } = usePage(homeSlug)
  const permissions = usePermissions()
  const unsubscribeWiki = useUnsubscribeWiki()
  const pageTitle = data && 'page' in data && typeof data.page === 'object' && data.page?.title ? data.page.title : 'Home'
  usePageTitle(pageTitle)

  // Register page with sidebar context for tree expansion
  const { setPage } = useSidebarContext()
  useEffect(() => {
    setPage(homeSlug, pageTitle)
    return () => setPage(null)
  }, [homeSlug, pageTitle, setPage])

  // Store last visited location
  useEffect(() => {
    setLastLocation(wikiId, homeSlug)
  }, [wikiId, homeSlug])

  // Rename dialog state (controlled mode so menu closes when dialog opens)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)

  // Unsubscribe handler
  const handleUnsubscribe = useCallback(() => {
    unsubscribeWiki.mutate(undefined, {
      onSuccess: () => {
        toast.success('Unsubscribed')
        void navigate({ to: '/' })
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, 'Failed to unsubscribe'))
      },
    })
  }, [unsubscribeWiki, navigate])

  // Can unsubscribe if viewing a subscribed wiki (has source)
  const { info } = useWikiContext()
  const canUnsubscribe = !!info?.wiki?.source

  // RSS feed handler
  const handleCopyRssUrl = async (mode: 'changes' | 'comments' | 'all') => {
    try {
      const { token } = await getRssToken(wikiId, mode)
      const url = `${window.location.origin}/wikis/${wikiId}/-/rss?token=${token}`
      await navigator.clipboard.writeText(url)
      toast.success('RSS URL copied to clipboard')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to get RSS token'))
    }
  }

  if (isLoading) {
    return (
      <>
        <Header />
        <Main>
          <PageViewSkeleton />
        </Main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Header />
        <Main>
          <div className="text-destructive">
            Error loading page: {error.message}
          </div>
        </Main>
      </>
    )
  }

  // Check if page was not found
  if (data && 'error' in data && data.error === 'not_found') {
    return (
      <>
        <Header>
          <h1 className="text-lg font-semibold">Page not found</h1>
        </Header>
        <Main>
          <PageNotFound slug={homeSlug} wikiId={wikiId} />
        </Main>
      </>
    )
  }

  // Page found
  if (data && 'page' in data && typeof data.page === 'object') {
    const actionsMenu = (
      <div className="flex items-center gap-2">
        {canUnsubscribe && (
          <Button
            variant="outline"
            onClick={handleUnsubscribe}
            disabled={unsubscribeWiki.isPending}
          >
            {unsubscribeWiki.isPending ? 'Unsubscribing...' : 'Unsubscribe'}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Ellipsis className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Page</DropdownMenuLabel>
            {permissions.edit && (
              <DropdownMenuItem asChild>
                <Link to="/$page/edit" params={{ page: homeSlug }}>
                  <Pencil className="size-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
            )}
            {permissions.edit && (
              <DropdownMenuItem onSelect={() => setRenameDialogOpen(true)}>
                <FileEdit className="size-4" />
                Rename
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link to="/$page/history" params={{ page: homeSlug }}>
                <History className="size-4" />
                History
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Wiki</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link to="/search">
                <Search className="size-4" />
                Search
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/tags">
                <Tags className="size-4" />
                Tags
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/changes">
                <History className="size-4" />
                Recent changes
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Rss className="mr-2 size-4" />
                RSS feed
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onSelect={() => void handleCopyRssUrl('changes')}>Changes</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleCopyRssUrl('comments')}>Comments</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleCopyRssUrl('all')}>Changes and comments</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {permissions.edit && (
              <DropdownMenuItem asChild>
                <Link to="/new">
                  <FilePlus className="size-4" />
                  New page
                </Link>
              </DropdownMenuItem>
            )}
            {permissions.manage && (
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <Settings className="size-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )

    return (
      <>
        <Header>
          <PageHeader page={data.page} actions={actionsMenu} />
        </Header>
        <Main className="pt-2">
          <PageView page={data.page} missingLinks={'missing_links' in data ? data.missing_links : undefined} />
        </Main>
        <RenamePageDialog
          slug={homeSlug}
          title={data.page.title}
          open={renameDialogOpen}
          onOpenChange={setRenameDialogOpen}
        />
      </>
    )
  }

  return null
}

interface WikisListPageProps {
  wikis?: Array<{ id: string; name: string; home: string; source?: string; fingerprint?: string }>
}

interface RecommendedWiki {
  id: string
  name: string
  blurb: string
  fingerprint: string
}

interface RecommendationsResponse {
  wikis: RecommendedWiki[]
}

function WikisListPage({ wikis }: WikisListPageProps) {
  usePageTitle('Wikis')
  const { openCreateDialog } = useSidebarContext()
  const [pendingWikiId, setPendingWikiId] = useState<string | null>(null)

  // RSS feed handler for all wikis
  const handleCopyRssUrl = async (mode: 'changes' | 'comments' | 'all') => {
    try {
      const { token } = await getRssToken('*', mode)
      const url = `${window.location.origin}/wikis/-/rss?token=${token}`
      await navigator.clipboard.writeText(url)
      toast.success('RSS URL copied to clipboard')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to get RSS token'))
    }
  }

  // Clear last location when viewing "All wikis"
  useEffect(() => {
    clearLastLocation()
  }, [])

  // Combine all wikis into a single list with type indicators
  const allWikis: WikiItem[] = [
    ...(wikis || []).map((w) => ({
      id: w.id,
      name: w.name,
      type: (w.source ? 'subscribed' : 'owned') as WikiType,
      fingerprint: w.fingerprint,
      home: w.home,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name))

  const hasWikis = allWikis.length > 0

  // Set of subscribed wiki IDs for inline search
  const subscribedWikiIds = useMemo(
    () => new Set(allWikis.flatMap((w) => [w.id, w.fingerprint].filter((x): x is string => !!x))),
    [allWikis]
  )

  // Recommendations query
  const {
    data: recommendationsData,
    isError: isRecommendationsError,
  } = useQuery({
    queryKey: ['wikis', 'recommendations'],
    queryFn: () => wikisRequest.get<RecommendationsResponse>(endpoints.wiki.recommendations),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const recommendations = recommendationsData?.wikis ?? []

  const handleSubscribeRecommendation = async (wiki: RecommendedWiki) => {
    setPendingWikiId(wiki.id)
    try {
      await wikisRequest.post(endpoints.wiki.subscribe, { target: wiki.id })
      // Reload page to refresh wikis list
      window.location.reload()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to subscribe'))
      setPendingWikiId(null)
    }
  }

  const getIcon = (type: WikiType) => {
    switch (type) {
      case 'owned':
        return <BookOpen className="h-5 w-5" />
      case 'subscribed':
        return <Link2 className="h-5 w-5" />
    }
  }

  return (
    <>
      <CommonPageHeader
        title="Wikis"
        icon={<BookOpen className="size-4 md:size-5" />}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Ellipsis className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Rss className="mr-2 size-4" />
                  RSS feed
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => void handleCopyRssUrl('changes')}>Changes</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void handleCopyRssUrl('comments')}>Comments</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void handleCopyRssUrl('all')}>Changes and comments</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <Main>
        <div className="container mx-auto p-6">
          {!hasWikis ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <BookOpen className="text-muted-foreground mx-auto mb-3 h-10 w-10 opacity-50" />
              <p className="text-muted-foreground mb-1 text-sm font-medium">Wikis</p>
            <p className="text-muted-foreground mb-4 max-w-sm text-xs">
              You have no wikis yet.
            </p>
            <InlineWikiSearch subscribedIds={subscribedWikiIds} />
            <Button variant="outline" onClick={openCreateDialog} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Create a new wiki
            </Button>

            {/* Recommendations Section */}
            {!isRecommendationsError && recommendations.filter((rec) => !subscribedWikiIds.has(rec.id)).length > 0 && (
              <>
                <hr className="my-6 w-full max-w-md border-t" />
                <div className="w-full max-w-md">
                  <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
                    Recommended wikis
                  </p>
                  <div className="divide-border divide-y rounded-lg border text-left">
                    {recommendations
                      .filter((rec) => !subscribedWikiIds.has(rec.id))
                      .map((rec) => {
                        const isPending = pendingWikiId === rec.id

                        return (
                          <div
                            key={rec.id}
                            className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/10">
                                <BookOpen className="h-4 w-4 text-emerald-600" />
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm font-medium">{rec.name}</span>
                                {rec.blurb && (
                                  <span className="text-muted-foreground truncate text-xs">
                                    {rec.blurb}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleSubscribeRecommendation(rec)}
                              disabled={isPending}
                            >
                              {isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Subscribe'
                              )}
                            </Button>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {allWikis.map((wiki) => (
              <Card key={wiki.id} className="transition-colors hover:bg-highlight relative">
                <Link to="/$wikiId/$page" params={{ wikiId: wiki.fingerprint ?? wiki.id, page: wiki.home }} className="block">
                  <CardHeader className="flex items-center justify-center py-8">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      {getIcon(wiki.type)}
                      {wiki.name}
                    </CardTitle>
                  </CardHeader>
                </Link>
              </Card>
            ))}
          </div>
          )}
        </div>
      </Main>
    </>
  )
}
