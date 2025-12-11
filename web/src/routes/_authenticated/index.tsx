import { createFileRoute, Link } from '@tanstack/react-router'
import { requestHelpers } from '@/lib/request'
import endpoints from '@/api/endpoints'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, BookOpen } from 'lucide-react'
import { usePage } from '@/hooks/use-wiki'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { getAppPath } from '@/lib/app-path'
import {
  PageView,
  PageNotFound,
  PageViewSkeleton,
} from '@/features/wiki/page-view'

interface InfoResponse {
  entity: boolean
  wiki?: { id: string; name: string; home: string }
  wikis?: Array<{ id: string; name: string; home: string }>
}

export const Route = createFileRoute('/_authenticated/')({
  loader: async () => {
    const info = await requestHelpers.get<InfoResponse>(endpoints.wiki.info)
    return info
  },
  component: IndexPage,
})

function IndexPage() {
  const data = Route.useLoaderData()

  // If we're in entity context, show the wiki's home page directly
  if (data.entity && data.wiki) {
    return <WikiHomePage homeSlug={data.wiki.home} />
  }

  // Class context - show the wikis list
  return <WikisListPage wikis={data.wikis} />
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
        <Header />
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
        <Header />
        <Main>
          <PageView page={data.page} />
        </Main>
      </>
    )
  }

  return null
}

function WikisListPage({ wikis }: { wikis?: Array<{ id: string; name: string; home: string }> }) {

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Wikis</h1>
        <Link to="/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Wiki
          </Button>
        </Link>
      </div>

      {wikis && wikis.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {wikis.map((wiki) => (
            <a key={wiki.id} href={`${getAppPath()}/${wiki.id}`} className="block">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    {wiki.name}
                  </CardTitle>
                  <CardDescription>
                    {wiki.id.slice(0, 12)}...
                  </CardDescription>
                </CardHeader>
              </Card>
            </a>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No wikis yet</h2>
          <p className="text-muted-foreground mb-4">
            Create your first wiki to get started.
          </p>
          <Link to="/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Wiki
            </Button>
          </Link>
        </Card>
      )}
    </div>
  )
}
