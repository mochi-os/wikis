// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { ArrowRight, Plus, Trash2, Link2 } from 'lucide-react'
import {
  Button,
  DataChip,
  Input,
  Label,
  Separator,
  EmptyState,
  GeneralError,
  ListSkeleton,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  toast,
  getErrorMessage,
  useFormat,
} from '@mochi/web'
import { ValueLinkChip } from '@/components/value-link-chip'
import { useRedirects, useSetRedirect, useDeleteRedirect } from '@/hooks/use-wiki'
import type { Redirect } from '@/types/wiki'

export function RedirectsPage() {
  const { t } = useLingui()
  const { data, isLoading, error, refetch } = useRedirects()

  if (isLoading) {
    return <RedirectsPageSkeleton />
  }

  if (error) {
    return (
      <GeneralError error={error} minimal mode="inline" reset={refetch} />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link2 className="h-6 w-6" />
          <h1 className="text-2xl font-bold"><Trans>Redirects</Trans></h1>
        </div>
        <AddRedirectDialog />
      </div>

      <Separator />

      {/* Redirects table */}
      {!data?.redirects || data.redirects.length === 0 ? (
        <EmptyState
          icon={Link2}
          title={t`No redirects configured`}
          description={t`Create a redirect to forward one URL to another.`}
          className="py-8"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Trans>Source</Trans></TableHead>
              <TableHead></TableHead>
              <TableHead><Trans>Target</Trans></TableHead>
              <TableHead><Trans>Created</Trans></TableHead>
              <TableHead className="w-20"><Trans>Actions</Trans></TableHead>
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
  const { t } = useLingui()
  const { formatTimestamp } = useFormat()
  const deleteRedirect = useDeleteRedirect()

  const handleDelete = () => {
    deleteRedirect.mutate(redirect.source, {
      onSuccess: () => {
        toast.success(t`Redirect "${redirect.source}" deleted`)
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, t`Failed to delete redirect`))
      },
    })
  }

  return (
    <TableRow>
      <TableCell>
        <ValueLinkChip value={redirect.source} />
      </TableCell>
      <TableCell>
        <ArrowRight className="text-muted-foreground h-4 w-4 rtl:rotate-180" />
      </TableCell>
      <TableCell>
        <ValueLinkChip value={redirect.target} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        <DataChip
          value={formatTimestamp(redirect.created)}
          copyable={false}
        />
      </TableCell>
      <TableCell>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              aria-label={t`Delete redirect ${redirect.source}`}
              title={t`Delete redirect ${redirect.source}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle><Trans>Delete redirect?</Trans></AlertDialogTitle>
              <AlertDialogDescription>
                <Trans>
                  This will remove the redirect from "{redirect.source}" to "
                  {redirect.target}". Users visiting the source URL will no longer
                  be redirected.
                </Trans>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel><Trans>Cancel</Trans></AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Trans>Delete</Trans>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  )
}

function AddRedirectDialog() {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const setRedirect = useSetRedirect()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!source.trim() || !target.trim()) {
      toast.error(t`Both source and target are required`)
      return
    }

    setRedirect.mutate(
      { source: source.trim(), target: target.trim() },
      {
        onSuccess: () => {
          toast.success(t`Redirect created`)
          setSource('')
          setTarget('')
          setOpen(false)
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, t`Failed to create redirect`))
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="me-2 h-4 w-4" />
          <Trans>Add redirect</Trans>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle><Trans>Create redirect</Trans></DialogTitle>
            <DialogDescription>
              <Trans>
                Create a redirect from one URL to another. The source URL must not
                be an existing page.
              </Trans>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="source"><Trans>Source URL</Trans></Label>
              <Input
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder={t`old-page-name`}
              />
              <p className="text-muted-foreground text-sm">
                <Trans>The URL that will be redirected (e.g., "old-page")</Trans>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target"><Trans>Target URL</Trans></Label>
              <Input
                id="target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={t`new-page-name`}
              />
              <p className="text-muted-foreground text-sm">
                <Trans>The existing page to redirect to (e.g., "new-page")</Trans>
              </p>
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
            <Button type="submit" disabled={setRedirect.isPending}>
              {setRedirect.isPending ? t`Creating...` : <><Plus className="h-4 w-4 me-2" /><Trans>Create redirect</Trans></>}
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
      <ListSkeleton variant="simple" height="h-12" count={3} />
    </div>
  )
}
