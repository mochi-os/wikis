import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { RotateCcw, ArrowLeft } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Separator,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  getErrorMessage,
  toast,
} from '@mochi/web'
import { useRevertPage } from '@/hooks/use-wiki'

interface RevertPageProps {
  slug: string
  version: number
  wikiId?: string
}

export function RevertPage({ slug, version, wikiId }: RevertPageProps) {
  const revertPage = useRevertPage()
  const navigate = useNavigate()
  const [comment, setComment] = useState(`Reverted to version ${version}`)

  const handleRevert = () => {
    revertPage.mutate(
      { slug, version, comment },
      {
        onSuccess: () => {
          toast.success(`Reverted to version ${version}`)
          if (wikiId) {
            void navigate({ to: '/$wikiId/$page', params: { wikiId, page: slug } })
          } else {
            void navigate({ to: '/$page', params: { page: slug } })
          }
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, 'Failed to revert page'))
        },
      }
    )
  }

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Revert Page
          </CardTitle>
          <CardDescription>
            You are about to revert <strong>{slug}</strong> to version{' '}
            <strong>{version}</strong>. This will create a new revision with the
            content from version {version}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="comment">Revert comment</Label>
            <Input
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Reason for reverting"
            />
          </div>
        </CardContent>
        <Separator />
        <CardFooter className="flex justify-between pt-4">
          <Button variant="outline" asChild>
            {wikiId ? (
              <Link to="/$wikiId/$page/history" params={{ wikiId, page: slug }}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel
              </Link>
            ) : (
              <Link to="/$page/history" params={{ page: slug }}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel
              </Link>
            )}
          </Button>
          <Button
            variant="destructive"
            onClick={handleRevert}
            disabled={revertPage.isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {revertPage.isPending ? 'Reverting...' : 'Revert'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
