import { useState } from 'react'
import { FileEdit } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Checkbox,
  getErrorMessage,
  toast,
} from '@mochi/common'
import { useRenamePage } from '@/hooks/use-wiki'

interface RenamePageDialogProps {
  slug: string
  title: string
  trigger?: React.ReactNode
}

export function RenamePageDialog({ slug, title, trigger }: RenamePageDialogProps) {
  const [open, setOpen] = useState(false)
  const [newSlug, setNewSlug] = useState(slug)
  const [renameChildren, setRenameChildren] = useState(true)
  const [createRedirects, setCreateRedirects] = useState(false)
  const renamePage = useRenamePage()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSlug.trim()) {
      toast.error('New URL is required')
      return
    }
    if (newSlug === slug) {
      toast.error('New URL must be different from current URL')
      return
    }

    renamePage.mutate(
      {
        slug,
        newSlug: newSlug.trim(),
        children: renameChildren,
        redirects: createRedirects,
      },
      {
        onSuccess: (data) => {
          const renamedCount = data.renamed?.length || 1
          const linksUpdated = data.updated_links || 0
          let message = `Renamed ${renamedCount} page${renamedCount > 1 ? 's' : ''}`
          if (linksUpdated > 0) {
            message += `, updated ${linksUpdated} link${linksUpdated > 1 ? 's' : ''}`
          }
          toast.success(message)
          setOpen(false)
          // Navigate to new URL
          window.location.href = newSlug.trim()
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, 'Failed to rename page'))
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <FileEdit className="mr-2 h-4 w-4" />
            Rename
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename page</DialogTitle>
            <DialogDescription>
              Change the URL for "{title}". Links to this page will be updated automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newSlug">New URL</Label>
              <Input
                id="newSlug"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="new-page-url"
              />
              <p className="text-sm text-muted-foreground">
                Use lowercase letters, numbers, hyphens, and slashes
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="renameChildren"
                checked={renameChildren}
                onCheckedChange={(checked) => setRenameChildren(checked === true)}
              />
              <Label htmlFor="renameChildren" className="font-normal">
                Rename child pages
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="createRedirects"
                checked={createRedirects}
                onCheckedChange={(checked) => setCreateRedirects(checked === true)}
              />
              <Label htmlFor="createRedirects" className="font-normal">
                Create redirect from old links
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={renamePage.isPending}>
              {renamePage.isPending ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
