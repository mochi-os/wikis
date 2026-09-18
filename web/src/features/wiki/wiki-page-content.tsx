// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate } from '@tanstack/react-router'
import type { PageResponse, PageNotFoundResponse } from '@/types/wiki'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  usePageTitle,
  requestHelpers,
  Main,
  ConfirmDialog,
  GeneralError,
  toastAction,
  getErrorMessage,
} from '@mochi/web'
import endpoints from '@/api/endpoints'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'
import { useRssCopy } from '@/hooks/use-rss-copy'
import { setLastLocation } from '@/hooks/use-wiki-storage'
import { useWikiLinkDialog } from '@/components/link-dialog'
import { DeletePageDialog } from '@/features/wiki/delete-page'
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

interface WikiPageContentProps {
  wikiId: string
  slug: string
  // Set by the $wikiId index route's domain branch, where the URL is a single
  // page-slug segment rather than /$wikiId/$page.
  domain?: boolean
}

// Shared page content component used by both the $wikiId/$page route and
// the $wikiId index route (for domain routing where $wikiId is a page slug).
export function WikiPageContent({
  wikiId,
  slug,
  domain,
}: WikiPageContentProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  const { baseURL, wiki, permissions } = useWikiBaseURL()
  const backLabel = wiki.name ?? t`Back to wikis`
  const { openLinkDialog, linkDialog } = useWikiLinkDialog(
    wiki.fingerprint ?? wiki.id
  )

  // Can unsubscribe if viewing a subscribed wiki (has source)
  const canUnsubscribe = !!wiki.source
  const [isUnsubscribing, setIsUnsubscribing] = useState(false)
  const [unsubscribeConfirmOpen, setUnsubscribeConfirmOpen] = useState(false)

  const handleUnsubscribe = useCallback(async () => {
    setIsUnsubscribing(true)
    try {
      await toastAction(requestHelpers.post(`${baseURL}unsubscribe`, {}), {
        loading: t`Unsubscribing...`,
        success: t`Unsubscribed`,
        error: (error) => getErrorMessage(error, t`Failed to unsubscribe`),
      })
      setUnsubscribeConfirmOpen(false)
      void navigate({ to: '/' })
    } catch {
      setIsUnsubscribing(false)
    }
  }, [baseURL, navigate, t])

  const shouldRedirect = !slug

  // Fetch page data using the wiki's base URL
  const {
    data,
    isLoading,
    error: pageError,
    refetch,
  } = useQuery({
    // Keyed on the base URL, which is the prefix invalidatePage invalidates.
    // Keying on the fingerprint meant no page mutation ever matched, so tags
    // and the comment count stayed stale until a refocus or a navigation.
    queryKey: ['wiki', baseURL, 'page', slug],
    queryFn: () =>
      requestHelpers.get<PageResponse | PageNotFoundResponse>(
        `${baseURL}${endpoints.wiki.page(slug)}`
      ),
    enabled: !shouldRedirect,
  })

  // Handle case where API returns non-JSON (e.g., HTML error page)
  const isValidResponse = data && typeof data === 'object'
  const pageTitle = shouldRedirect
    ? (wiki.name ?? t`Wiki`)
    : isValidResponse &&
        'page' in data &&
        typeof data.page === 'object' &&
        data.page?.title
      ? data.page.title
      : slug
  usePageTitle(pageTitle)

  // Store last visited location (prefer fingerprint for shorter URLs)
  useEffect(() => {
    if (shouldRedirect) return
    setLastLocation(wiki.fingerprint ?? wiki.id, slug)
  }, [shouldRedirect, wiki.fingerprint, wiki.id, slug])

  // A page reached through a redirect renders under the requested slug while
  // its canonical slug differs. Replace the URL with the canonical slug so
  // the address, the query cache and mutation invalidation all agree.
  const canonical =
    isValidResponse && 'page' in data && typeof data.page === 'object'
      ? data.page?.slug
      : undefined
  useEffect(() => {
    if (shouldRedirect || !canonical || canonical === slug) return
    if (domain) {
      void navigate({
        to: '/$wikiId',
        params: { wikiId: canonical },
        replace: true,
      })
    } else {
      void navigate({
        to: '/$wikiId/$page',
        params: { wikiId, page: canonical },
        replace: true,
      })
    }
  }, [shouldRedirect, canonical, slug, wikiId, domain, navigate])

  // Rename dialog state (controlled mode so menu closes when dialog opens)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // RSS feed handler
  const rss = useRssCopy(wikiId)

  if (shouldRedirect) {
    return <Navigate to='/$wikiId' params={{ wikiId }} />
  }

  if (isLoading) {
    return (
      <>
        <WikiRouteHeader
          title={pageTitle}
          back={{ label: backLabel, onFallback: goBackToWikis }}
        />
        <Main>
          <PageViewSkeleton />
        </Main>
      </>
    )
  }

  if (pageError) {
    return (
      <>
        <WikiRouteHeader
          title={pageTitle}
          back={{ label: backLabel, onFallback: goBackToWikis }}
        />
        <Main>
          <GeneralError
            error={pageError}
            minimal
            mode='inline'
            reset={refetch}
          />
        </Main>
      </>
    )
  }

  // Handle invalid response (e.g., server returned HTML instead of JSON)
  if (data && !isValidResponse) {
    return (
      <>
        <WikiRouteHeader
          title={pageTitle}
          back={{ label: backLabel, onFallback: goBackToWikis }}
        />
        <Main>
          <div className='text-destructive'>
            <p>
              <Trans>Error: Received invalid response from server.</Trans>
            </p>
            <p className='text-muted-foreground mt-2 text-sm'>
              <Trans>
                Request URL: {baseURL}
                {slug}
              </Trans>
            </p>
          </div>
        </Main>
      </>
    )
  }

  // Check if page was not found
  if (isValidResponse && 'error' in data && data.error === 'not_found') {
    const notFoundMenu = (
      <PageMissingMenu
        slug={slug}
        wiki={wikiId}
        permissions={permissions}
        onLink={() => void openLinkDialog()}
      />
    )

    return (
      <>
        <WikiRouteHeader
          title={t`Page not found`}
          menuAction={notFoundMenu}
          back={{ label: backLabel, onFallback: goBackToWikis }}
        />
        <Main>
          <PageNotFound slug={slug} wikiId={wikiId} />
        </Main>
        {linkDialog}
      </>
    )
  }

  // Page found
  if (isValidResponse && 'page' in data && typeof data.page === 'object') {
    const commentCount =
      isValidResponse && 'comments' in data ? (data.comments?.count ?? 0) : 0

    const actionsMenu = (
      <PageActionsMenu
        slug={slug}
        wiki={wikiId}
        permissions={permissions}
        comments={commentCount}
        unsubscribable={canUnsubscribe}
        unsubscribing={isUnsubscribing}
        onRename={() => setRenameDialogOpen(true)}
        onDelete={() => setDeleteDialogOpen(true)}
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
          back={{ label: backLabel, onFallback: goBackToWikis }}
        />
        <Main className='pt-2'>
          <PageView
            page={data.page}
            missingLinks={'links' in data ? data.links?.missing : undefined}
            wikiId={wikiId}
          />
        </Main>
        <ConfirmDialog
          open={unsubscribeConfirmOpen}
          onOpenChange={setUnsubscribeConfirmOpen}
          title={t`Unsubscribe`}
          desc={t`Are you sure you want to unsubscribe from this wiki?`}
          confirmText={t`Unsubscribe`}
          destructive
          isLoading={isUnsubscribing}
          handleConfirm={() => void handleUnsubscribe()}
        />
        <DeletePageDialog
          slug={slug}
          title={data.page.title}
          wikiId={wikiId}
          homePage={wiki.home}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
        />
        <RenamePageDialog
          slug={slug}
          wikiId={wikiId}
          open={renameDialogOpen}
          onOpenChange={setRenameDialogOpen}
        />
        {linkDialog}
      </>
    )
  }

  return null
}
