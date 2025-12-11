import { createFileRoute, Link } from '@tanstack/react-router'
import { requestHelpers } from '@/lib/request'
import endpoints from '@/api/endpoints'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, BookOpen } from 'lucide-react'

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
  beforeLoad: async () => {
    const info = await requestHelpers.get<InfoResponse>(endpoints.wiki.info)
    if (info.entity && info.wiki) {
      // Entity context - redirect to wiki home page
      // Use absolute URL with wiki entity ID to avoid basepath issues
      window.location.href = `/wiki/${info.wiki.id}/${info.wiki.home}`
    }
    // Class context - will render the wikis list component
  },
  component: WikisListPage,
})

function WikisListPage() {
  const { wikis } = Route.useLoaderData()

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
            <a key={wiki.id} href={`/wiki/${wiki.id}`} className="block">
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
