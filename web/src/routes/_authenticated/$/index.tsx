import { createFileRoute, Link, Navigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { usePage } from '@/hooks/use-wiki'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Ellipsis, FileEdit, FilePlus, History, Pencil, Settings } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/$/')({
  component: WikiPageRoute,
})

function WikiPageRoute() {
  const params = Route.useParams()
  const slug = params._splat ?? ''

  // If splat is empty, redirect to wiki home
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

  // Store last visited location
  useEffect(() => {
    if (info?.wiki?.id) {
      setLastLocation(info.wiki.id, slug)
    }
  }, [info?.wiki?.id, slug])

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
          {permissions.edit && (
            <DropdownMenuItem asChild>
              <Link to="/$/edit" params={{ _splat: slug }}>
                <Pencil className="size-4" />
                Edit page
              </Link>
            </DropdownMenuItem>
          )}
          {permissions.edit && (
            <RenamePageDialog
              slug={slug}
              title={data.page.title}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <FileEdit className="size-4" />
                  Rename page
                </DropdownMenuItem>
              }
            />
          )}
          <DropdownMenuItem asChild>
            <Link to="/$/history" params={{ _splat: slug }}>
              <History className="size-4" />
              Page history
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
                Wiki settings
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
      </>
    )
  }

  return null
}
