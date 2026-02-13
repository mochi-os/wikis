import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Link2, BookOpen, Search } from 'lucide-react'
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
  Main,
  getErrorMessage,
  toast,
} from '@mochi/common'
import { useJoinWiki } from '@/hooks/use-wiki'
import { useSidebarContext } from '@/context/sidebar-context'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/join')({
  component: JoinWikiPage,
})

function JoinWikiPage() {
  usePageTitle('Replicate wiki')
  const navigate = useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  const [target, setTarget] = useState('')
  const joinWiki = useJoinWiki()
  const { openSearchDialog } = useSidebarContext()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!target.trim()) {
      toast.error('Wiki ID is required')
      return
    }
    joinWiki.mutate({ target: target.trim() }, {
      onSuccess: () => {
        toast.success('Joined wiki')
        navigate({ to: '/' })
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, 'Failed to join wiki'))
      },
    })
  }

  const handleCancel = () => {
    navigate({ to: '/' })
  }

  return (
    <>
      <WikiRouteHeader title="Replicate wiki" back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
      <Main>
        <div className="container mx-auto max-w-lg p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Replicate wiki
              </CardTitle>
              <CardDescription>
                Search for public wikis or enter an entity ID directly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={openSearchDialog}
                >
                  <Search className="h-4 w-4" />
                  Search for wikis...
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or enter ID directly
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="target">Wiki entity ID</Label>
                  <Input
                    id="target"
                    placeholder="abc123..."
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  />
                  <p className="text-muted-foreground text-sm">
                    The entity ID of the wiki you want to replicate.
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={joinWiki.isPending}
                  >
                    Cancel
                  </Button>
                  <Button variant="outline" type="submit" disabled={joinWiki.isPending || !target.trim()}>
                    <Link2 className="mr-2 h-4 w-4" />
                    {joinWiki.isPending ? 'Replicating...' : 'Replicate wiki'}
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
