import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { Plus, BookOpen } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  usePageTitle,
  Header,
  Main,
  requestHelpers,
  getErrorMessage,
  toast,
} from '@mochi/common'
import { PageEditor } from '@/features/wiki/page-editor'
import endpoints from '@/api/endpoints'

interface InfoResponse {
  entity: boolean
  wiki?: { id: string; name: string; home: string }
  wikis?: Array<{ id: string; name: string; home: string }>
}

interface CreateWikiResponse {
  id: string
  name: string
  home: string
}

const searchSchema = z.object({
  slug: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/new')({
  validateSearch: searchSchema,
  loader: async () => {
    const info = await requestHelpers.get<InfoResponse>(endpoints.wiki.info)
    return info
  },
  component: NewRoute,
})

function NewRoute() {
  const { entity } = Route.useLoaderData()

  if (entity) {
    return <NewPageView />
  } else {
    return <NewWikiView />
  }
}

function NewPageView() {
  usePageTitle('New page')
  const { slug } = Route.useSearch()

  return (
    <>
      <Header />
      <Main>
        <PageEditor slug={slug ?? ''} isNew />
      </Main>
    </>
  )
}

function NewWikiView() {
  usePageTitle('New wiki')
  const navigate = useNavigate()
  const [name, setName] = useState('')

  const createWiki = useMutation({
    mutationFn: (data: { name: string }) =>
      requestHelpers.post<CreateWikiResponse>(endpoints.wiki.create, data),
    onSuccess: () => {
      toast.success('Wiki created')
      navigate({ to: '/' })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to create wiki'))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Wiki name is required')
      return
    }
    createWiki.mutate({ name: name.trim() })
  }

  const handleCancel = () => {
    navigate({ to: '/' })
  }

  return (
    <>
      <Header />
      <Main>
        <div className="container mx-auto max-w-lg p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Create New Wiki
              </CardTitle>
              <CardDescription>
                Create a new wiki to organize your knowledge.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Wiki name</Label>
                  <Input
                    id="name"
                    placeholder="My Wiki"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={createWiki.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createWiki.isPending}>
                    <Plus className="mr-2 h-4 w-4" />
                    {createWiki.isPending ? 'Creating...' : 'Create wiki'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
