import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { FileEdit } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
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
  wikiId?: string
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function RenamePageDialog({ slug, title: _title, wikiId, trigger, open: controlledOpen, onOpenChange }: RenamePageDialogProps) {
  const navigate = useNavigate()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [newSlug, setNewSlug] = useState(slug)
  const [createRedirects, setCreateRedirects] = useState(false)
  const renamePage = useRenamePage()

  // Reset newSlug when dialog opens or slug changes
  useEffect(() => {
    if (open) {
      setNewSlug(slug)
    }
  }, [open, slug])

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
          const targetSlug = newSlug.trim()
          if (wikiId) {
            navigate({ to: '/$wikiId/$page', params: { wikiId, page: targetSlug } })
          } else {
            navigate({ to: '/$page', params: { page: targetSlug } })
          }
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, 'Failed to rename page'))
        },
      }
    )
  }

  const dialogContent = (
    <DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Rename page</DialogTitle>
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
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="createRedirects"
              checked={createRedirects}
              onCheckedChange={(checked) => setCreateRedirects(checked === true)}
            />
            <Label htmlFor="createRedirects" className="font-normal">
              Create redirect from old URL
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
  )

  // Controlled mode - no trigger, dialog controlled externally
  if (controlledOpen !== undefined) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {dialogContent}
      </Dialog>
    )
  }

  // Uncontrolled mode - with trigger
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
      {dialogContent}
    </Dialog>
  )
}
