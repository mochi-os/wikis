import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Link2, BookOpen } from 'lucide-react'
import { Button } from '@mochi/common'
import { Input } from '@mochi/common'
import { Label } from '@mochi/common'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@mochi/common'
import { Header } from '@mochi/common'
import { Main } from '@mochi/common'
import { useJoinWiki } from '@/hooks/use-wiki'

export const Route = createFileRoute('/_authenticated/join')({
  component: JoinWikiPage,
})

function JoinWikiPage() {
  const navigate = useNavigate()
  const [target, setTarget] = useState('')
  const joinWiki = useJoinWiki()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!target.trim()) {
      toast.error('Wiki ID is required')
      return
    }
    joinWiki.mutate(target.trim(), {
      onSuccess: () => {
        toast.success('Wiki joined successfully')
        navigate({ to: '/' })
      },
      onError: (error: Error) => {
        toast.error(error.message || 'Failed to join wiki')
      },
    })
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
                Join wiki
              </CardTitle>
              <CardDescription>
                Join an existing wiki from another server by entering its entity ID.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="target">Wiki entity ID</Label>
                  <Input
                    id="target"
                    placeholder="abc123..."
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    autoFocus
                  />
                  <p className="text-muted-foreground text-sm">
                    The entity ID of the wiki you want to join. You can get this
                    from the wiki owner.
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
                  <Button type="submit" disabled={joinWiki.isPending}>
                    <Link2 className="mr-2 h-4 w-4" />
                    {joinWiki.isPending ? 'Joining...' : 'Join wiki'}
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
