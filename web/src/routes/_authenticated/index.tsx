import { createFileRoute, Link } from '@tanstack/react-router'
import { requestHelpers } from '@/lib/request'
import endpoints from '@/api/endpoints'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, BookOpen, Link2, Bookmark, X } from 'lucide-react'
import { usePage, useAddBookmark, useRemoveBookmark } from '@/hooks/use-wiki'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { getAppPath } from '@/lib/app-path'
import {
  PageView,
  PageNotFound,
  PageViewSkeleton,
} from '@/features/wiki/page-view'
import { PageHeader } from '@/features/wiki/page-header'
import { GeneralError } from '@/features/errors/general-error'

interface InfoResponse {
  entity: boolean
  wiki?: { id: string; name: string; home: string }
  wikis?: Array<{ id: string; name: string; home: string; source?: string }>
  bookmarks?: Array<{ id: string; name: string; added: number }>
}

type WikiType = 'owned' | 'subscribed' | 'bookmarked'

interface WikiItem {
  id: string
  name: string
  type: WikiType
}

export const Route = createFileRoute('/_authenticated/')({
  loader: async () => {
    const info = await requestHelpers.get<InfoResponse>(endpoints.wiki.info)
    return info
  },
  component: IndexPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function IndexPage() {
  const data = Route.useLoaderData()

  // If we're in entity context, show the wiki's home page directly
  if (data.entity && data.wiki) {
    return <WikiHomePage homeSlug={data.wiki.home} />
  }

  // Class context - show the wikis list
  return <WikisListPage wikis={data.wikis} bookmarks={data.bookmarks} />
}

function WikiHomePage({ homeSlug }: { homeSlug: string }) {
  const { data, isLoading, error } = usePage(homeSlug)

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
          <PageNotFound slug={homeSlug} />
        </Main>
      </>
    )
  }

  // Page found
  if (data && 'page' in data && typeof data.page === 'object') {
    return (
      <>
        <Header>
          <PageHeader page={data.page} />
        </Header>
        <Main>
          <PageView page={data.page} />
        </Main>
      </>
    )
  }

  return null
}

interface WikisListPageProps {
  wikis?: Array<{ id: string; name: string; home: string; source?: string }>
  bookmarks?: Array<{ id: string; name: string; added: number }>
}

function WikisListPage({ wikis, bookmarks }: WikisListPageProps) {
  const [bookmarkTarget, setBookmarkTarget] = useState('')
  const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false)
  const addBookmark = useAddBookmark()
  const removeBookmark = useRemoveBookmark()

  const handleAddBookmark = (e: React.FormEvent) => {
    e.preventDefault()
    if (!bookmarkTarget.trim()) {
      toast.error('Wiki ID is required')
      return
    }
    addBookmark.mutate(bookmarkTarget.trim(), {
      onSuccess: () => {
        toast.success('Wiki bookmarked')
        setBookmarkTarget('')
        setBookmarkDialogOpen(false)
      },
      onError: (error: Error) => {
        toast.error(error.message || 'Failed to bookmark wiki')
      },
    })
  }

  const handleRemoveBookmark = (id: string) => {
    removeBookmark.mutate(id, {
      onSuccess: () => {
        toast.success('Bookmark removed')
      },
      onError: (error: Error) => {
        toast.error(error.message || 'Failed to remove bookmark')
      },
    })
  }

  // Combine all wikis into a single list with type indicators
  const allWikis: WikiItem[] = [
    ...(wikis || []).map((w) => ({
      id: w.id,
      name: w.name,
      type: (w.source ? 'subscribed' : 'owned') as WikiType,
    })),
    ...(bookmarks || []).map((b) => ({
      id: b.id,
      name: b.name,
      type: 'bookmarked' as WikiType,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name))

  const hasWikis = allWikis.length > 0

  const getIcon = (type: WikiType) => {
    switch (type) {
      case 'owned':
        return <BookOpen className="h-5 w-5" />
      case 'subscribed':
        return <Link2 className="h-5 w-5" />
      case 'bookmarked':
        return <Bookmark className="h-5 w-5" />
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Wikis</h1>
        <div className="flex gap-2">
          <Dialog open={bookmarkDialogOpen} onOpenChange={setBookmarkDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="hover:bg-highlight">
                <Bookmark className="mr-2 h-4 w-4" />
                Bookmark wiki
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bookmark wiki</DialogTitle>
                <DialogDescription>
                  Follow a wiki without making a local copy. You'll be able to view it directly from the source.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddBookmark} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bookmark-target">Wiki entity ID</Label>
                  <Input
                    id="bookmark-target"
                    placeholder="abc123..."
                    value={bookmarkTarget}
                    onChange={(e) => setBookmarkTarget(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBookmarkDialogOpen(false)}
                    disabled={addBookmark.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addBookmark.isPending}>
                    <Bookmark className="mr-2 h-4 w-4" />
                    {addBookmark.isPending ? 'Bookmarking...' : 'Bookmark'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Link to="/join">
            <Button variant="outline" className="hover:bg-highlight">
              <Link2 className="mr-2 h-4 w-4" />
              Join wiki
            </Button>
          </Link>
          <Link to="/new">
            <Button variant="outline" className="hover:bg-highlight">
              <Plus className="mr-2 h-4 w-4" />
              Create wiki
            </Button>
          </Link>
        </div>
      </div>

      {!hasWikis ? (
        <Card className="p-8 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No wikis yet</h2>
          <p className="text-muted-foreground mb-4">
            Create a new wiki, join an existing one, or bookmark a wiki to follow.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="ghost" className="hover:bg-[#FFF8F0]" onClick={() => setBookmarkDialogOpen(true)}>
              <Bookmark className="mr-2 h-4 w-4" />
              Bookmark wiki
            </Button>
            <Link to="/join">
              <Button variant="outline" className="hover:bg-highlight">
                <Link2 className="mr-2 h-4 w-4" />
                Join wiki
              </Button>
            </Link>
            <Link to="/new">
              <Button variant="outline" className="hover:bg-highlight">
                <Plus className="mr-2 h-4 w-4" />
                Create wiki
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {allWikis.map((wiki) => (
            <Card key={wiki.id} className="transition-colors hover:bg-highlight relative">
              <a href={`${getAppPath()}/${wiki.id}`} className="block">
                <CardHeader className="flex items-center justify-center py-8">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    {getIcon(wiki.type)}
                    {wiki.name}
                  </CardTitle>
                </CardHeader>
              </a>
              {wiki.type === 'bookmarked' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 absolute top-2 right-2"
                  onClick={() => handleRemoveBookmark(wiki.id)}
                  disabled={removeBookmark.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
