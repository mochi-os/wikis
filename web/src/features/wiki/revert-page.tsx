import { useState } from 'react'
import { RotateCcw, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useRevertPage } from '@/hooks/use-wiki'

interface RevertPageProps {
  slug: string
  version: number
}

export function RevertPage({ slug, version }: RevertPageProps) {
  const revertPage = useRevertPage()
  const [comment, setComment] = useState(`Reverted to version ${version}`)

  const handleRevert = () => {
    revertPage.mutate(
      { slug, version, comment },
      {
        onSuccess: () => {
          toast.success(`Reverted to version ${version}`)
          window.location.href = slug
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to revert page')
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
            <a href={`${slug}/history`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </a>
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
