import { Trash2, ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Button,
  Separator,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  getErrorMessage,
  toast,
} from '@mochi/common'
import { useDeletePage } from '@/hooks/use-wiki'

interface DeletePageProps {
  wikiId?: string
  slug: string
  title: string
  homePage?: string
}

export function DeletePage({ wikiId, slug, title, homePage = 'home' }: DeletePageProps) {
  const deletePage = useDeletePage()
  const navigate = useNavigate()

  const handleDelete = () => {
    deletePage.mutate(slug, {
      onSuccess: () => {
        toast.success(`Page "${title}" deleted`)
        if (wikiId) {
          navigate({ to: '/$wikiId/$page', params: { wikiId, page: homePage } })
        } else {
          navigate({ to: '/$page', params: { page: homePage } })
        }
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, 'Failed to delete page'))
      },
    })
  }

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Delete page
          </CardTitle>
          <CardDescription>
            You are about to delete the page <strong>"{title}"</strong> ({slug}).
            This action can be undone by restoring from history.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardFooter className="flex justify-between pt-4">
          <Button variant="outline" asChild>
            {wikiId ? (
              <Link to="/$wikiId/$page" params={{ wikiId, page: slug }}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel
              </Link>
            ) : (
              <Link to="/$page" params={{ page: slug }}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel
              </Link>
            )}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deletePage.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deletePage.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
