// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import {
  ConfirmDialog,
  GeneralError,
  usePageTitle,
  toastAction,
  getErrorMessage,
  Main,
} from '@mochi/web'
import { useWikiContext, usePermissions } from '@/context/wiki-context'
import { useRssCopy } from '@/hooks/use-rss-copy'
import { usePage, useUnsubscribeWiki } from '@/hooks/use-wiki'
import { setLastLocation } from '@/hooks/use-wiki-storage'
import { useWikiLinkDialog } from '@/components/link-dialog'
import {
  PageActionsMenu,
  PageMissingMenu,
} from '@/features/wiki/page-actions-menu'
import { PageHeader } from '@/features/wiki/page-header'
import {
  PageView,
  PageNotFound,
  PageViewSkeleton,
} from '@/features/wiki/page-view'
import { RenamePageDialog } from '@/features/wiki/rename-page-dialog'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

export const Route = createFileRoute('/_authenticated/$page/')({
  component: WikiPageRoute,
})

function WikiPageRoute() {
  const { t } = useLingui()
  const params = Route.useParams()
  const slug = params.page ?? ''
  const navigate = useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })

  const { data, isLoading, error, refetch } = usePage(slug)
  const { info } = useWikiContext()
  const permissions = usePermissions()
  const unsubscribeWiki = useUnsubscribeWiki()
  const wikiEntity = info?.wiki?.fingerprint ?? info?.wiki?.id
  const { openLinkDialog, linkDialog } = useWikiLinkDialog(wikiEntity)
  const rss = useRssCopy(wikiEntity ?? '')
  const pageTitle =
    data && 'page' in data && typeof data.page === 'object' && data.page?.title
      ? data.page.title
      : slug
  usePageTitle(pageTitle)

  // A page reached through a redirect renders under the requested slug while
  // its canonical slug differs. Replace the URL with the canonical slug so
  // the address, the query cache and mutation invalidation all agree.
  const canonical =
    data && 'page' in data && typeof data.page === 'object'
      ? data.page?.slug
      : undefined
  useEffect(() => {
    if (!canonical || canonical === slug) return
    void navigate({ to: '/$page', params: { page: canonical }, replace: true })
  }, [canonical, slug, navigate])

  // Store last visited location (prefer fingerprint for shorter URLs)
  useEffect(() => {
    const wikiId = info?.wiki?.fingerprint ?? info?.wiki?.id
    if (wikiId) {
      setLastLocation(wikiId, slug)
    }
  }, [info?.wiki?.fingerprint, info?.wiki?.id, slug])

  // Rename dialog state (controlled mode so menu closes when dialog opens)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [unsubscribeConfirmOpen, setUnsubscribeConfirmOpen] = useState(false)

  // Unsubscribe handler
  const handleUnsubscribe = useCallback(async () => {
    try {
      await toastAction(unsubscribeWiki.mutateAsync(), {
        loading: t`Unsubscribing...`,
        success: t`Unsubscribed`,
        error: (error) => getErrorMessage(error, t`Failed to unsubscribe`),
      })
      setUnsubscribeConfirmOpen(false)
      void navigate({ to: '/' })
    } catch {
      // toast already shown
    }
  }, [unsubscribeWiki, navigate, t])

  // Can unsubscribe if viewing a subscribed wiki (has source)
  const canUnsubscribe = !!info?.wiki?.source

  if (!slug) {
    return <Navigate to='/' />
  }

  if (isLoading) {
    return (
      <>
        <WikiRouteHeader
          title={pageTitle}
          back={{ label: t`Back to wikis`, onFallback: goBackToWikis }}
        />
        <Main>
          <PageViewSkeleton />
        </Main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <WikiRouteHeader
          title={pageTitle}
          back={{ label: t`Back to wikis`, onFallback: goBackToWikis }}
        />
        <Main>
          <GeneralError error={error} minimal mode='inline' reset={refetch} />
        </Main>
      </>
    )
  }

  // Check if page was not found
  if (data && 'error' in data && data.error === 'not_found') {
    const notFoundMenu = (
      <PageMissingMenu
        slug={slug}
        permissions={permissions}
        onLink={() => void openLinkDialog()}
      />
    )

    return (
      <>
        <WikiRouteHeader
          title={t`Page not found`}
          menuAction={notFoundMenu}
          back={{ label: t`Back to wikis`, onFallback: goBackToWikis }}
        />
        <Main>
          <PageNotFound slug={slug} />
        </Main>
      </>
    )
  }

  // Page found
  if (data && 'page' in data && typeof data.page === 'object') {
    const commentCount =
      data && 'comments' in data ? (data.comments?.count ?? 0) : 0

    const actionsMenu = (
      <PageActionsMenu
        slug={slug}
        permissions={permissions}
        comments={commentCount}
        unsubscribable={canUnsubscribe}
        unsubscribing={unsubscribeWiki.isPending}
        onRename={() => setRenameDialogOpen(true)}
        onLink={() => void openLinkDialog()}
        onUnsubscribe={() => setUnsubscribeConfirmOpen(true)}
        onRss={(mode) => void rss.copy(mode)}
        onRevoke={() => void rss.revoke()}
      />
    )

    return (
      <>
        <PageHeader
          page={data.page}
          menuAction={actionsMenu}
          back={{ label: t`Back to wikis`, onFallback: goBackToWikis }}
        />
        <Main className='pt-2'>
          <PageView
            page={data.page}
            missingLinks={'links' in data ? data.links?.missing : undefined}
          />
        </Main>
        {linkDialog}
        <ConfirmDialog
          open={unsubscribeConfirmOpen}
          onOpenChange={setUnsubscribeConfirmOpen}
          title={t`Unsubscribe`}
          desc={t`Are you sure you want to unsubscribe from this wiki?`}
          confirmText={t`Unsubscribe`}
          destructive
          isLoading={unsubscribeWiki.isPending}
          handleConfirm={handleUnsubscribe}
        />
        <RenamePageDialog
          slug={slug}
          open={renameDialogOpen}
          onOpenChange={setRenameDialogOpen}
        />
      </>
    )
  }

  return null
}
