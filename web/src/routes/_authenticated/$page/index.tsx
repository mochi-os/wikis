import { createFileRoute, Link, Navigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { usePage } from '@/hooks/use-wiki'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  usePageTitle,
} from '@mochi/common'
import {
  PageView,
  PageNotFound,
  PageViewSkeleton,
} from '@/features/wiki/page-view'
import { PageHeader } from '@/features/wiki/page-header'
import { RenamePageDialog } from '@/features/wiki/rename-page-dialog'
import { Header } from '@mochi/common'
import { Main } from '@mochi/common'
import { useSidebarContext } from '@/context/sidebar-context'
import { useWikiContext, usePermissions } from '@/context/wiki-context'
import { setLastLocation } from '@/hooks/use-wiki-storage'
import { Ellipsis, FileEdit, FilePlus, History, Pencil, Search, Settings, Tags } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/$page/')({
  component: WikiPageRoute,
})

function WikiPageRoute() {
  const params = Route.useParams()
  const slug = params.page ?? ''

  // If page param is empty, redirect to wiki home
  if (!slug) {
    return <Navigate to="/" />
  }

  const { data, isLoading, error } = usePage(slug)
  const { info } = useWikiContext()
  const permissions = usePermissions()
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
              <Link to="/$page/edit" params={{ page: slug }}>
                <FilePlus className="size-4" />
                Create this page
              </Link>
            </DropdownMenuItem>
          )}
          {permissions.edit && (
            <DropdownMenuItem asChild>
              <Link to="/new">
                <FilePlus className="size-4" />
                New page
              </Link>
            </DropdownMenuItem>
          )}
          {permissions.manage && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings">
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
        <Header>
          <div className="flex flex-1 items-center justify-between gap-4">
            <h1 className="text-lg font-semibold">Page not found</h1>
            {notFoundMenu}
          </div>
        </Header>
        <Main>
          <PageNotFound slug={slug} />
        </Main>
      </>
    )
  }

  // Page found
  if (data && 'page' in data && typeof data.page === 'object') {
    const actionsMenu = (
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
              <Link to="/$page/edit" params={{ page: slug }}>
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
            <Link to="/$page/history" params={{ page: slug }}>
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
    )

    return (
      <>
        <Header>
          <PageHeader page={data.page} actions={actionsMenu} />
        </Header>
        <Main className="pt-2">
          <PageView page={data.page} />
        </Main>
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
