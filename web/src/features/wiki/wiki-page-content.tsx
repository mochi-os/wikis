// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import { plural } from '@lingui/core/macro'
import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  usePageTitle,
  requestHelpers,
  Main,
  Button,
  ConfirmDialog,
  GeneralError,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  toast,
  toastAction,
  getErrorMessage,
  getAppPath,
  shellClipboardWrite,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@mochi/web'
import { Ellipsis, FileEdit, FilePlus, History, Link as LinkIcon, LogOut, MessageSquare, Pencil, Rss, Search, Settings, Tags, Trash2 } from 'lucide-react'
import {
  PageView,
  PageNotFound,
  PageViewSkeleton,
} from '@/features/wiki/page-view'
import { PageHeader } from '@/features/wiki/page-header'
import { RenamePageDialog } from '@/features/wiki/rename-page-dialog'
import { useWikiLinkDialog } from '@/components/link-dialog'
import { useSidebarContext } from '@/context/sidebar-context'
import { useWikiBaseURL } from '@/context/wiki-base-url-context'
import { setLastLocation } from '@/hooks/use-wiki-storage'
import { getRssToken } from '@/api/request'
import type { PageResponse, PageNotFoundResponse } from '@/types/wiki'
import { WikiRouteHeader } from '@/features/wiki/wiki-route-header'

interface WikiPageContentProps {
  wikiId: string
  slug: string
}

// Shared page content component used by both the $wikiId/$page route and
// the $wikiId index route (for domain routing where $wikiId is a page slug).
export function WikiPageContent({ wikiId, slug }: WikiPageContentProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const goBackToWikis = () => navigate({ to: '/' })
  const { baseURL, wiki, permissions } = useWikiBaseURL()
  const backLabel = wiki.name ?? t`Back to wikis`
  const { openLinkDialog, linkDialog } = useWikiLinkDialog(wiki.fingerprint ?? wiki.id)

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
  const { data, isLoading, error: pageError, refetch } = useQuery({
    queryKey: ['wiki', wikiId, 'page', slug, baseURL],
    queryFn: () =>
      requestHelpers.get<PageResponse | PageNotFoundResponse>(`${baseURL}${slug}`),
    enabled: !shouldRedirect,
  })

  // Handle case where API returns non-JSON (e.g., HTML error page)
  const isValidResponse = data && typeof data === 'object'
  const pageTitle = shouldRedirect
    ? (wiki.name ?? t`Wiki`)
    : isValidResponse && 'page' in data && typeof data.page === 'object' && data.page?.title
      ? data.page.title
      : slug
  usePageTitle(pageTitle)

  // Register page with sidebar context for tree expansion
  const { setPage } = useSidebarContext()
  useEffect(() => {
    if (shouldRedirect) return
    setPage(slug, pageTitle)
    return () => setPage(null)
  }, [shouldRedirect, slug, pageTitle, setPage])

  // Store last visited location (prefer fingerprint for shorter URLs)
  useEffect(() => {
    if (shouldRedirect) return
    setLastLocation(wiki.fingerprint ?? wiki.id, slug)
  }, [shouldRedirect, wiki.fingerprint, wiki.id, slug])

  // Rename dialog state (controlled mode so menu closes when dialog opens)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)

  // RSS feed handler
  const handleCopyRssUrl = async (mode: 'changes' | 'comments' | 'all') => {
    try {
      const { token } = await getRssToken(wikiId, mode)
      const url = `${window.location.origin}${getAppPath()}/${wikiId}/-/rss?token=${token}`
      const ok = await shellClipboardWrite(url)
      if (ok) toast.success(t`RSS URL copied to clipboard`)
    } catch (error) {
      toast.error(getErrorMessage(error, t`Failed to get RSS token`))
    }
  }

  if (shouldRedirect) {
    return <Navigate to="/$wikiId" params={{ wikiId }} />
  }

  if (isLoading) {
    return (
      <>
        <WikiRouteHeader title={pageTitle} back={{ label: backLabel, onFallback: goBackToWikis }} />
        <Main>
          <PageViewSkeleton />
        </Main>
      </>
    )
  }

  if (pageError) {
    return (
      <>
        <WikiRouteHeader title={pageTitle} back={{ label: backLabel, onFallback: goBackToWikis }} />
        <Main>
          <GeneralError error={pageError} minimal mode="inline" reset={refetch} />
        </Main>
      </>
    )
  }

  // Handle invalid response (e.g., server returned HTML instead of JSON)
  if (data && !isValidResponse) {
    return (
      <>
        <WikiRouteHeader title={pageTitle} back={{ label: backLabel, onFallback: goBackToWikis }} />
        <Main>
          <div className="text-destructive">
            <p><Trans>Error: Received invalid response from server.</Trans></p>
            <p className="text-muted-foreground mt-2 text-sm">
              <Trans>Request URL: {baseURL}{slug}</Trans>
            </p>
          </div>
        </Main>
      </>
    )
  }

  // Check if page was not found
  if (isValidResponse && 'error' in data && data.error === 'not_found') {
    const notFoundMenu = (
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t`Page actions`}
              >
                <Ellipsis className="size-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{t`Page actions`}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          {permissions.edit && (
            <DropdownMenuItem asChild>
              <Link preload={false} to="/$wikiId/$page/edit" params={{ wikiId, page: slug }}>
                <FilePlus className="size-4" />
                <Trans>Create this page</Trans>
              </Link>
            </DropdownMenuItem>
          )}
          {permissions.manage && (
            <>
              <DropdownMenuSeparator />
              {/* Canonical menu tail: Link, then Settings. */}
              <DropdownMenuItem onSelect={() => void openLinkDialog()}>
                <LinkIcon className="size-4" />
                <Trans>Link</Trans>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link preload={false} to="/$wikiId/settings" params={{ wikiId }}>
                  <Settings className="size-4" />
                  <Trans>Wiki settings</Trans>
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
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
    const commentCount = isValidResponse && 'comment_count' in data ? (data.comment_count ?? 0) : 0

    const actionsMenu = (
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t`Page actions`}
                className="size-11 md:size-9"
              >
                <Ellipsis className="size-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{t`Page actions`}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel><Trans>Page</Trans></DropdownMenuLabel>
          {permissions.edit && (
            <DropdownMenuItem asChild>
              <Link preload={false} to="/$wikiId/$page/edit" params={{ wikiId, page: slug }}>
                <Pencil className="size-4" />
                <Trans>Edit</Trans>
              </Link>
            </DropdownMenuItem>
          )}
          {permissions.edit && (
            <DropdownMenuItem onSelect={() => setRenameDialogOpen(true)}>
              <FileEdit className="size-4" />
              <Trans>Rename</Trans>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link preload={false} to="/$wikiId/$page/history" params={{ wikiId, page: slug }}>
              <History className="size-4" />
              <Trans>History</Trans>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link preload={false} to="/$wikiId/$page/comments" params={{ wikiId, page: slug }}>
              <MessageSquare className="size-4" />
              {plural(commentCount, { one: '1 comment', other: '# comments' })}
            </Link>
          </DropdownMenuItem>
          {permissions.edit && (
            <DropdownMenuItem asChild>
              <Link preload={false} to="/$wikiId/$page/delete" params={{ wikiId, page: slug }}>
                <Trash2 className="size-4" />
                <Trans>Delete</Trans>
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel><Trans>Wiki</Trans></DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link preload={false} to="/$wikiId/search" params={{ wikiId }}>
              <Search className="size-4" />
              <Trans>Search</Trans>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link preload={false} to="/tags">
              <Tags className="size-4" />
              <Trans>Tags</Trans>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link preload={false} to="/$wikiId/changes" params={{ wikiId }}>
              <History className="size-4" />
              <Trans>Recent changes</Trans>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Rss className="me-2 size-4" />
              <Trans>RSS feed</Trans>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => void handleCopyRssUrl('changes')}><Trans>Changes</Trans></DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleCopyRssUrl('comments')}><Trans>Comments</Trans></DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleCopyRssUrl('all')}><Trans>Changes and comments</Trans></DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {permissions.edit && (
            <DropdownMenuItem asChild>
              <Link preload={false} to="/$wikiId/new" params={{ wikiId }}>
                <FilePlus className="size-4" />
                <Trans>New page</Trans>
              </Link>
            </DropdownMenuItem>
          )}
          {/* Canonical menu tail: Link, Design (n/a here), Settings, Unsubscribe. */}
          {permissions.manage && (
            <DropdownMenuItem onSelect={() => void openLinkDialog()}>
              <LinkIcon className="size-4" />
              <Trans>Link</Trans>
            </DropdownMenuItem>
          )}
          {permissions.manage && (
            <DropdownMenuItem asChild>
              <Link preload={false} to="/$wikiId/settings" params={{ wikiId }}>
                <Settings className="size-4" />
                <Trans>Settings</Trans>
              </Link>
            </DropdownMenuItem>
          )}
          {canUnsubscribe && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setUnsubscribeConfirmOpen(true)}
                disabled={isUnsubscribing}
              >
                <LogOut className="size-4" />
                {isUnsubscribing ? t`Unsubscribing...` : t`Unsubscribe`}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )

    return (
      <>
        <PageHeader
          page={data.page}
          menuAction={actionsMenu}
          back={{ label: backLabel, onFallback: goBackToWikis }}
        />
        <Main className="pt-2">
          <PageView page={data.page} missingLinks={'missing_links' in data ? data.missing_links : undefined} />
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
        <RenamePageDialog
          slug={slug}
          title={data.page.title}
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
