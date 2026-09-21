// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useNavigate } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import { ConfirmDialog, getErrorMessage, toast } from '@mochi/web'
import { useDeletePage } from '@/hooks/use-wiki'

interface DeletePageDialogProps {
  wikiId?: string
  slug: string
  title: string
  homePage?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Opened from the page actions menu. Delete used to be a route of its own,
// the only page action other than revert that left the page to confirm.
export function DeletePageDialog({
  wikiId,
  slug,
  title,
  homePage = 'home',
  open,
  onOpenChange,
}: DeletePageDialogProps) {
  const { t } = useLingui()
  const deletePage = useDeletePage()
  const navigate = useNavigate()

  const handleDelete = () => {
    deletePage.mutate(slug, {
      onSuccess: () => {
        onOpenChange(false)
        toast.success(t`Page "${title}" deleted`)
        if (wikiId) {
          void navigate({
            to: '/$wikiId/$page',
            params: { wikiId, page: homePage },
          })
        } else {
          void navigate({ to: '/$page', params: { page: homePage } })
        }
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, t`Failed to delete page`))
      },
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t`Delete page`}
      desc={
        <p>
          <Trans>
            You are about to delete the page <strong>"{title}"</strong> ({slug}
            ). This action can be undone by restoring from history.
          </Trans>
        </p>
      }
      confirmText={t`Delete`}
      destructive
      isLoading={deletePage.isPending}
      handleConfirm={handleDelete}
    />
  )
}
