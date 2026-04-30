import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
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
} from '@mochi/web'
import { useJoinWiki } from '@/hooks/use-wiki'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/join')({
  component: JoinWikiPage,
})

function JoinWikiPage() {
  const { t } = useLingui()
  usePageTitle(t`Replicate wiki`)
  const navigate = useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  const [target, setTarget] = useState('')
  const joinWiki = useJoinWiki()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!target.trim()) {
      toast.error(t`Wiki ID is required`)
      return
    }
    joinWiki.mutate({ target: target.trim() }, {
      onSuccess: () => {
        toast.success(t`Joined wiki`)
        navigate({ to: '/' })
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, t`Failed to join wiki`))
      },
    })
  }

  const handleCancel = () => {
    navigate({ to: '/' })
  }

  return (
    <>
      <WikiRouteHeader title={t`Replicate wiki`} back={{ label: 'Back to wikis', onFallback: goBackToWikis }} />
      <Main>
        <div className="container mx-auto max-w-lg p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                <Trans>Replicate wiki</Trans>
              </CardTitle>
              <CardDescription>
                <Trans>Search for public wikis or enter an entity ID directly.</Trans>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => navigate({ to: '/find' })}
                >
                  <Search className="h-4 w-4" />
                  <Trans>Search for wikis...</Trans>
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    <Trans>Or enter ID directly</Trans>
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="target"><Trans>Wiki entity ID</Trans></Label>
                  <Input
                    id="target"
                    placeholder="abc123..."
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  />
                  <p className="text-muted-foreground text-sm">
                    <Trans>The entity ID of the wiki you want to replicate.</Trans>
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={joinWiki.isPending}
                  >
                    <Trans>Cancel</Trans>
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
