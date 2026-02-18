import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  usePageTitle,
  requestHelpers,
  Main,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  toast,
  getErrorMessage,
  getAppPath,
} from '@mochi/common'
import { Ellipsis, FileEdit, FilePlus, History, MessageSquare, Pencil, Rss, Search, Settings, Tags, Trash2 } from 'lucide-react'
import {
  PageView,
  PageNotFound,
  PageViewSkeleton,
} from '@/features/wiki/page-view'
import { PageHeader } from '@/features/wiki/page-header'
import { RenamePageDialog } from '@/features/wiki/rename-page-dialog'
import { useSidebarContext } from '@/context/sidebar-context'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'
import { setLastLocation } from '@/hooks/use-wiki-storage'
import { getRssToken } from '@/api/request'
import type { PageResponse, PageNotFoundResponse } from '@/types/wiki'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

interface WikiPageContentProps {
  wikiId: string
  slug: string
}

// Shared page content component used by both the $wikiId/$page route and
// the $wikiId index route (for domain routing where $wikiId is a page slug).
export function WikiPageContent({ wikiId, slug }: WikiPageContentProps) {
  const navigate = useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  const { baseURL, wiki, permissions } = useWikiBaseURL()

  // Can unsubscribe if viewing a subscribed wiki (has source)
  const canUnsubscribe = !!wiki.source
  const [isUnsubscribing, setIsUnsubscribing] = useState(false)

  const handleUnsubscribe = useCallback(async () => {
    setIsUnsubscribing(true)
    try {
      await requestHelpers.post(`${baseURL}unsubscribe`, {})
      toast.success('Unsubscribed')
      void navigate({ to: '/' })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to unsubscribe'))
      setIsUnsubscribing(false)
    }
  }, [baseURL, navigate])

  // If slug is empty, redirect to wiki home
  if (!slug) {
    return <Navigate to="/$wikiId" params={{ wikiId }} />
  }

  // Fetch page data using the wiki's base URL
  const { data, isLoading, error: pageError } = useQuery({
    queryKey: ['wiki', wikiId, 'page', slug],
    queryFn: () =>
      requestHelpers.get<PageResponse | PageNotFoundResponse>(`${baseURL}${slug}`),
    enabled: !!slug,
  })

  // Handle case where API returns non-JSON (e.g., HTML error page)
  const isValidResponse = data && typeof data === 'object'
  const pageTitle = isValidResponse && 'page' in data && typeof data.page === 'object' && data.page?.title ? data.page.title : slug
  usePageTitle(pageTitle)

  // Register page with sidebar context for tree expansion
  const { setPage } = useSidebarContext()
  useEffect(() => {
    setPage(slug, pageTitle)
    return () => setPage(null)
  }, [slug, pageTitle, setPage])

  // Store last visited location (prefer fingerprint for shorter URLs)
  useEffect(() => {
    setLastLocation(wiki.fingerprint ?? wiki.id, slug)
  }, [wiki.fingerprint, wiki.id, slug])

  // Rename dialog state (controlled mode so menu closes when dialog opens)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)

  // RSS feed handler
  const handleCopyRssUrl = async (mode: 'changes' | 'comments' | 'all') => {
    try {
      const { token } = await getRssToken(wikiId, mode)
      const url = `${window.location.origin}${getAppPath()}/${wikiId}/-/rss?token=${token}`
      await navigator.clipboard.writeText(url)
      toast.success('RSS URL copied to clipboard')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to get RSS token'))
    }
  }

  if (isLoading) {
    return (
      <>
        <WikiRouteHeader title={pageTitle} back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
        <Main>
          <PageViewSkeleton />
        </Main>
      </>
    )
  }

  if (pageError) {
    return (
      <>
        <WikiRouteHeader title={pageTitle} back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
        <Main>
          <div className="text-destructive">
            Error loading page: {pageError.message}
          </div>
        </Main>
      </>
    )
  }

  // Handle invalid response (e.g., server returned HTML instead of JSON)
  if (data && !isValidResponse) {
    const rawData = data as unknown
    console.error('[WikiPage] Invalid API response:', { baseURL, slug, data: typeof rawData === 'string' ? rawData.slice(0, 100) : rawData })
    return (
      <>
        <WikiRouteHeader title={pageTitle} back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
        <Main>
          <div className="text-destructive">
            <p>Error: Received invalid response from server.</p>
            <p className="text-muted-foreground mt-2 text-sm">
              Request URL: {baseURL}{slug}
            </p>
          </div>
        </Main>
      </>
    )
  }

  // Check if page was not found
  if (isValidResponse && 'error' in data && data.error === 'not_found') {
    const notFoundMenu = (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {permissions.edit && (
            <DropdownMenuItem asChild>
              <Link to="/$wikiId/$page/edit" params={{ wikiId, page: slug }}>
                <FilePlus className="size-4" />
                Create this page
              </Link>
            </DropdownMenuItem>
          )}
          {permissions.edit && (
            <DropdownMenuItem asChild>
              <Link to="/$wikiId/new" params={{ wikiId }}>
                <FilePlus className="size-4" />
                New page
              </Link>
            </DropdownMenuItem>
          )}
          {permissions.manage && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/$wikiId/settings" params={{ wikiId }}>
                  <Settings className="size-4" />
                  Wiki settings
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )

    return (
      <>
        <WikiRouteHeader
          title="Page not found"
          actions={notFoundMenu}
          back={{ label: 'Back to wikis', onFallback: goBackToWikis }}
        />
        <Main>
          <PageNotFound slug={slug} wikiId={wikiId} />
        </Main>
      </>
    )
  }

  // Page found
  if (isValidResponse && 'page' in data && typeof data.page === 'object') {
    const commentCount = isValidResponse && 'comment_count' in data ? (data.comment_count ?? 0) : 0

    const actionsMenu = (
      <div className="flex items-center gap-2">
        {commentCount > 0 && (
          <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" asChild>
            <Link to="/$wikiId/$page/comments" params={{ wikiId, page: slug }}>
              <MessageSquare className="size-4" />
              {commentCount === 1 ? '1 comment' : `${commentCount} comments`}
            </Link>
          </Button>
        )}
        {canUnsubscribe && (
          <Button
            variant="outline"
            onClick={handleUnsubscribe}
            disabled={isUnsubscribing}
          >
            {isUnsubscribing ? 'Unsubscribing...' : 'Unsubscribe'}
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
              <Link to="/$wikiId/$page/edit" params={{ wikiId, page: slug }}>
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
            <Link to="/$wikiId/$page/history" params={{ wikiId, page: slug }}>
              <History className="size-4" />
              History
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/$wikiId/$page/comments" params={{ wikiId, page: slug }}>
              <MessageSquare className="size-4" />
              Comments
            </Link>
          </DropdownMenuItem>
          {permissions.edit && (
            <DropdownMenuItem asChild>
              <Link to="/$wikiId/$page/delete" params={{ wikiId, page: slug }}>
                <Trash2 className="size-4" />
                Delete
              </Link>
            </DropdownMenuItem>
          )}
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
              <Link to="/$wikiId/new" params={{ wikiId }}>
                <FilePlus className="size-4" />
                New page
              </Link>
            </DropdownMenuItem>
          )}
          {permissions.manage && (
            <DropdownMenuItem asChild>
              <Link to="/$wikiId/settings" params={{ wikiId }}>
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
        <PageHeader
          page={data.page}
          actions={actionsMenu}
          back={{ label: 'Back to wikis', onFallback: goBackToWikis }}
        />
        <Main className="pt-2">
          <PageView page={data.page} missingLinks={'missing_links' in data ? data.missing_links : undefined} />
        </Main>
        <RenamePageDialog
          slug={slug}
          title={data.page.title}
          wikiId={wikiId}
          open={renameDialogOpen}
          onOpenChange={setRenameDialogOpen}
        />
      </>
    )
  }

  return null
}
