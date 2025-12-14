import { useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { ArrowRight, Plus, Trash2, Link2 } from 'lucide-react'
import { Button } from '@mochi/common'
import { Input } from '@mochi/common'
import { Label } from '@mochi/common'
import { Separator } from '@mochi/common'
import { Skeleton } from '@mochi/common'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@mochi/common'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@mochi/common'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@mochi/common'
import { useRedirects, useSetRedirect, useDeleteRedirect } from '@/hooks/use-wiki'
import type { Redirect } from '@/types/wiki'

export function RedirectsPage() {
  const { data, isLoading, error } = useRedirects()

  if (isLoading) {
    return <RedirectsPageSkeleton />
  }

  if (error) {
    return (
      <div className="text-destructive">
        Error loading redirects: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link2 className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Redirects</h1>
        </div>
        <AddRedirectDialog />
      </div>

      <p className="text-muted-foreground">
        Manage URL redirects for your wiki. Redirects allow old or alternative
        URLs to point to existing pages.
      </p>

      <Separator />

      {/* Redirects table */}
      {!data?.redirects || data.redirects.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          No redirects configured. Create a redirect to forward one URL to another.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead></TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.redirects.map((redirect) => (
              <RedirectRow key={redirect.source} redirect={redirect} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

function RedirectRow({ redirect }: { redirect: Redirect }) {
  const deleteRedirect = useDeleteRedirect()

  const handleDelete = () => {
    deleteRedirect.mutate(redirect.source, {
      onSuccess: () => {
        toast.success(`Redirect "${redirect.source}" deleted`)
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to delete redirect')
      },
    })
  }

  return (
    <TableRow>
      <TableCell className="font-mono">{redirect.source}</TableCell>
      <TableCell>
        <ArrowRight className="text-muted-foreground h-4 w-4" />
      </TableCell>
      <TableCell>
        <a href={redirect.target} className="font-mono hover:underline">
          {redirect.target}
        </a>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {format(new Date(redirect.created * 1000), 'PPP')}
      </TableCell>
      <TableCell>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete redirect?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the redirect from "{redirect.source}" to "
                {redirect.target}". Users visiting the source URL will no longer
                be redirected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  )
}

function AddRedirectDialog() {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const setRedirect = useSetRedirect()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!source.trim() || !target.trim()) {
      toast.error('Both source and target are required')
      return
    }

    setRedirect.mutate(
      { source: source.trim(), target: target.trim() },
      {
        onSuccess: () => {
          toast.success('Redirect created')
          setSource('')
          setTarget('')
          setOpen(false)
        },
        onError: (error) => {
          toast.error(error.message || 'Failed to create redirect')
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Redirect
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Redirect</DialogTitle>
            <DialogDescription>
              Create a redirect from one URL to another. The source URL must not
              be an existing page.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="source">Source URL</Label>
              <Input
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="old-page-name"
              />
              <p className="text-muted-foreground text-sm">
                The URL that will be redirected (e.g., "old-page")
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target">Target URL</Label>
              <Input
                id="target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="new-page-name"
              />
              <p className="text-muted-foreground text-sm">
                The existing page to redirect to (e.g., "new-page")
              </p>
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
            <Button type="submit" disabled={setRedirect.isPending}>
              {setRedirect.isPending ? 'Creating...' : 'Create Redirect'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function RedirectsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-5 w-96" />
      <Separator />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
