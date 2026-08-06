// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useCallback, useMemo } from 'react'
import { useLingui } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import {
  AuthenticatedLayout,
  toastAction,
  getErrorMessage,
  type SidebarData,
  type NavItem,
  CreateEntityDialog,
  type CreateEntityValues, naturalCompare,} from '@mochi/web'
import {
  BookOpen,
  Plus,
  Search,
} from 'lucide-react'
import { SidebarProvider, useSidebarContext } from '@/context/sidebar-context'
import { WikiProvider, useWikiContext } from '@/context/wiki-context'
import { useCreateWiki } from '@/hooks/use-wiki'
import { useWikiWebsocket } from '@/hooks/use-wiki-websocket'
import { getEntityIdFromPath } from '@/api/request'

function WikiLayoutInner() {
  const { t } = useLingui()
  const {
    createDialogOpen,
    openCreateDialog,
    closeCreateDialog,
  } = useSidebarContext()
  const { info } = useWikiContext()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Use router location for reactive URL changes
  const location = useLocation()
  const urlEntityId = getEntityIdFromPath(location.pathname)

  // Refresh wiki content the moment remote sync data (initial dump or live
  // broadcast) lands locally, instead of waiting for a manual reload. The
  // websocket key is the wiki's fingerprint, matching the server's
  // mochi.websocket.write(mochi.entity.fingerprint(wiki), ...). Entity
  // context carries it in info.wiki, but the class-context info call is
  // class-wide and has no current wiki, so there the fingerprint comes from
  // the route - directly when the URL segment is a fingerprint, through the
  // wiki list when it is a full entity id. On the list page neither exists
  // and the hook stays idle.
  const routeFingerprint =
    urlEntityId && urlEntityId.length === 9
      ? urlEntityId
      : info?.wikis?.find((wiki) => wiki.id === urlEntityId)?.fingerprint
  useWikiWebsocket(info?.wiki?.fingerprint ?? routeFingerprint)

  // Handle "All wikis" click - navigate and refresh the list
  const handleAllWikisClick = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['wiki', 'info'] })
    navigate({ to: '/' })
  }, [queryClient, navigate])
  const createWiki = useCreateWiki()

  // Whether we're inside a specific wiki - use URL as source of truth
  const isInWiki = urlEntityId !== null
  const wikiName = info?.wiki?.name

  const handleCreateWiki = async (values: CreateEntityValues) => {
    const data = await toastAction(
      createWiki.mutateAsync({ name: values.name, privacy: values.privacy }),
      {
        loading: t`Creating wiki...`,
        success: t`Wiki created`,
        error: (e) => getErrorMessage(e, t`Failed to create wiki`),
      }
    )
    closeCreateDialog()
    const wikiId = data.fingerprint ?? data.id
    void navigate({ to: '/$wikiId/$page', params: { wikiId, page: data.home } })
  }

  const sidebarData: SidebarData = useMemo(() => {
    // Get current wiki ID for highlighting - use URL as source of truth
    const currentWikiId = urlEntityId

    // Keep the wiki sidebar flat to avoid burying page navigation inside it.
    const wikiItems: NavItem[] = [...(info?.wikis || [])]
      .sort((a, b) => naturalCompare(a.name, b.name))
      .map((wiki) => ({
        title: wiki.name,
        url: `/${wiki.fingerprint ?? wiki.id}/${wiki.home}` as const,
        icon: BookOpen,
        isActive: wiki.id === currentWikiId || wiki.fingerprint === currentWikiId,
      }))

    // Build current wiki item when in entity context but not in the wikis list
    const currentWikiInList = info?.wikis?.some(w => w.id === currentWikiId || w.fingerprint === currentWikiId)
    const standaloneWikiUrl = info?.wiki?.fingerprint ?? info?.wiki?.id ?? urlEntityId
    const standaloneWikiHome = info?.wiki?.home || 'home'
    const standaloneWikiItem: NavItem | null = isInWiki && !currentWikiInList && standaloneWikiUrl ? {
      title: wikiName || t`Wiki`,
      url: `/${standaloneWikiUrl}/${standaloneWikiHome}` as const,
      icon: BookOpen,
      isActive: true,
    } : null

    // "All wikis" is now a simple link without submenu
    const allWikisItem = {
      title: t`All wikis`,
      onClick: handleAllWikisClick,
      icon: BookOpen,
      aggregate: true,
      isActive: location.pathname === '/',
    }

    const groups: SidebarData['navGroups'] = [
      {
        title: '',
        items: [
          allWikisItem,
          ...wikiItems,
          ...(standaloneWikiItem ? [standaloneWikiItem] : []),
        ],
      },
      {
        title: '',
        separator: true,
        items: [
          { title: t`Find wikis`, icon: Search, url: '/find' },
          { title: t`Create wiki`, icon: Plus, onClick: openCreateDialog },
        ],
      },
    ]

    return { navGroups: groups }
  }, [isInWiki, wikiName, info, urlEntityId, handleAllWikisClick, openCreateDialog, location.pathname, t])

  return (
    <>
      <AuthenticatedLayout
        sidebarData={sidebarData}
        usePageHeaderForMobileNav
      />

      {/* Create wiki dialog */}
      <CreateEntityDialog
        open={createDialogOpen}
        onOpenChange={(open) => { if (!open) closeCreateDialog() }}
        icon={BookOpen}
        title={t`Create wiki`}
        entityLabel={t`Wiki`}
        showPrivacyToggle
        privacyLabel={t`Allow anyone to search for wiki`}
        onSubmit={handleCreateWiki}
        isPending={createWiki.isPending}
        hideTrigger
      />
    </>
  )
}

export function WikiLayout() {
  return (
    <WikiProvider>
      <SidebarProvider>
        <WikiLayoutInner />
      </SidebarProvider>
    </WikiProvider>
  )
}
