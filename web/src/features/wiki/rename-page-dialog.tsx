import { useState, useEffect } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { plural } from '@lingui/core/macro'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, Pencil } from 'lucide-react'
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
} from '@mochi/web'
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
  const { t } = useLingui()
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
      toast.error(t`New URL is required`)
      return
    }
    if (newSlug === slug) {
      toast.error(t`New URL must be different from current URL`)
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
          let message = plural(renamedCount, { one: 'Renamed 1 page', other: 'Renamed # pages' })
          if (linksUpdated > 0) {
            message += plural(linksUpdated, { one: ', updated 1 link', other: ', updated # links' })
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
          toast.error(getErrorMessage(error, t`Failed to rename page`))
        },
      }
    )
  }

  const dialogContent = (
    <DialogContent>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle><Trans>Rename page</Trans></DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="newSlug"><Trans>New URL</Trans></Label>
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
              <Trans>Create redirect from old URL</Trans>
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            <Trans>Cancel</Trans>
          </Button>
          <Button type="submit" disabled={renamePage.isPending}>
            {renamePage.isPending ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
            {renamePage.isPending ? t`Renaming...` : t`Rename`}
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
            <Pencil className="me-2 h-4 w-4" />
            <Trans>Rename</Trans>
          </Button>
        )}
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  )
}
