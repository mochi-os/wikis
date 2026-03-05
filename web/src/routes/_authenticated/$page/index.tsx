import { createFileRoute, Link, Navigate, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { usePage, useUnsubscribeWiki } from '@/hooks/use-wiki'
import { Button, ConfirmDialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, GeneralError, usePageTitle, toast, getErrorMessage, Main } from '@mochi/common'
import {
  PageView,
  PageNotFound,
  PageViewSkeleton,
} from '@/features/wiki/page-view'
import { PageHeader } from '@/features/wiki/page-header'
import { RenamePageDialog } from '@/features/wiki/rename-page-dialog'
import { useSidebarContext } from '@/context/sidebar-context'
import { useWikiContext, usePermissions } from '@/context/wiki-context'
import { setLastLocation } from '@/hooks/use-wiki-storage'
import { Ellipsis, FileEdit, FilePlus, History, MessageSquare, Pencil, Search, Settings, Tags } from 'lucide-react'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/$page/')({
  component: WikiPageRoute,
})

function WikiPageRoute() {
  const params = Route.useParams()
  const slug = params.page ?? ''
  const navigate = useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })



  const { data, isLoading, error, refetch } = usePage(slug)
  const { info } = useWikiContext()
  const permissions = usePermissions()
  const unsubscribeWiki = useUnsubscribeWiki()
  const pageTitle = data && 'page' in data && typeof data.page === 'object' && data.page?.title ? data.page.title : slug
  usePageTitle(pageTitle)

  // Register page with sidebar context for tree expansion
  const { setPage } = useSidebarContext()
  useEffect(() => {
    setPage(slug, pageTitle)
    return () => setPage(null)
  }, [slug, pageTitle, setPage])

  // Store last visited location (prefer fingerprint for shorter URLs)
  useEffect(() => {
    const wikiId = info?.wiki?.fingerprint ?? info?.wiki?.id
    if (wikiId) {
      setLastLocation(wikiId, slug)
    }
  }, [info?.wiki?.fingerprint, info?.wiki?.id, slug])

  // Rename dialog state (controlled mode so menu closes when dialog opens)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [unsubscribeConfirmOpen, setUnsubscribeConfirmOpen] = useState(false)

  // Unsubscribe handler
  const handleUnsubscribe = useCallback(() => {
    unsubscribeWiki.mutate(undefined, {
      onSuccess: () => {
        toast.success('Unsubscribed')
        setUnsubscribeConfirmOpen(false)
        void navigate({ to: '/' })
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, 'Failed to unsubscribe'))
      },
    })
  }, [unsubscribeWiki, navigate])

  // Can unsubscribe if viewing a subscribed wiki (has source)
  const canUnsubscribe = !!info?.wiki?.source

  if (!slug) {
    return <Navigate to="/" />
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

  if (error) {
    return (
      <>
        <WikiRouteHeader title={pageTitle} back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
        <Main>
          <GeneralError error={error} minimal mode="inline" reset={refetch} />
        </Main>
      </>
    )
  }

  // Check if page was not found
  if (data && 'error' in data && data.error === 'not_found') {
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
              <Link preload={false} to="/$page/edit" params={{ page: slug }}>
                <FilePlus className="size-4" />
                Create this page
              </Link>
            </DropdownMenuItem>
          )}
          {permissions.edit && (
            <DropdownMenuItem asChild>
              <Link preload={false} to="/new">
                <FilePlus className="size-4" />
                New page
              </Link>
            </DropdownMenuItem>
          )}
          {permissions.manage && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link preload={false} to="/settings">
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
          <PageNotFound slug={slug} />
        </Main>
      </>
    )
  }

  // Page found
  if (data && 'page' in data && typeof data.page === 'object') {
    const commentCount = data && 'comment_count' in data ? (data.comment_count ?? 0) : 0

    const actionsMenu = (
      <div className="flex items-center gap-2">
        {commentCount > 0 && (
          <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" asChild>
            <Link to="/$page/comments" params={{ page: slug }}>
              <MessageSquare className="size-4" />
              {commentCount === 1 ? '1 comment' : `${commentCount} comments`}
            </Link>
          </Button>
        )}
        {canUnsubscribe && (
          <Button
            variant="outline"
            onClick={() => setUnsubscribeConfirmOpen(true)}
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
                <Link preload={false} to="/$page/edit" params={{ page: slug }}>
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
              <Link preload={false} to="/$page/history" params={{ page: slug }}>
                <History className="size-4" />
                History
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link preload={false} to="/$page/comments" params={{ page: slug }}>
                <MessageSquare className="size-4" />
                Comments
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Wiki</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link preload={false} to="/search">
                <Search className="size-4" />
                Search
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link preload={false} to="/tags">
                <Tags className="size-4" />
                Tags
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link preload={false} to="/changes">
                <History className="size-4" />
                Recent changes
              </Link>
            </DropdownMenuItem>
            {permissions.edit && (
              <DropdownMenuItem asChild>
                <Link preload={false} to="/new">
                  <FilePlus className="size-4" />
                  New page
                </Link>
              </DropdownMenuItem>
            )}
            {permissions.manage && (
              <DropdownMenuItem asChild>
                <Link preload={false} to="/settings">
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
        <ConfirmDialog
          open={unsubscribeConfirmOpen}
          onOpenChange={setUnsubscribeConfirmOpen}
          title="Unsubscribe"
          desc="Are you sure you want to unsubscribe from this wiki?"
          confirmText="Unsubscribe"
          destructive
          isLoading={unsubscribeWiki.isPending}
          handleConfirm={handleUnsubscribe}
        />
        <RenamePageDialog
          slug={slug}
          title={data.page.title}
          open={renameDialogOpen}
          onOpenChange={setRenameDialogOpen}
        />
      </>
    )
  }

  return null
}
