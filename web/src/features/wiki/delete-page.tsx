import { Trash2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import {
  Button,
  Separator,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  getErrorMessage,
} from '@mochi/common'
import { useDeletePage } from '@/hooks/use-wiki'

interface DeletePageProps {
  slug: string
  title: string
}

export function DeletePage({ slug, title }: DeletePageProps) {
  const deletePage = useDeletePage()

  const handleDelete = () => {
    deletePage.mutate(slug, {
      onSuccess: () => {
        toast.success(`Page "${title}" deleted`)
        window.location.href = 'home'
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
        <CardContent>
          <p className="text-muted-foreground text-sm">
            The page will be soft-deleted. Its content and history will be
            preserved and can be restored later if needed.
          </p>
        </CardContent>
        <Separator />
        <CardFooter className="flex justify-between pt-4">
          <Button variant="outline" asChild>
            <a href={slug}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </a>
          </Button>
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={deletePage.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deletePage.isPending ? 'Deleting...' : 'Delete page'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
