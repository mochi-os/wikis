// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ComponentProps, ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import type { WikiPermissions } from '@/types/wiki'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@mochi/web'
import {
  Ellipsis,
  FileEdit,
  FilePlus,
  History,
  Link as LinkIcon,
  LogOut,
  MessageSquare,
  Pencil,
  Rss,
  Search,
  Settings,
  Tags,
  Trash2,
} from 'lucide-react'

// The page overflow menu, written once. It used to be inlined in all three
// page screens and had drifted apart: only one carried Delete, only one
// carried the comment count, the RSS submenu was missing from one and offered
// "Revoke access" in only one of the two that had it, and Unsubscribe wore a
// different icon in each.
//
// The two routing contexts differ only in the link targets: a class-context
// screen prefixes every route with the wiki segment, an entity- or
// domain-routed one does not. `wiki` present selects the first shape.

interface Target {
  to: string
  params?: Record<string, string>
}

// TanStack types `to` as the union of generated route literals paired with the
// matching params. Both shapes below come from that same set - one per routing
// context - so the widening is sound, and it is what lets the menu exist once
// instead of three times.
function MenuLink({
  target,
  children,
}: {
  target: Target
  children: ReactNode
}) {
  const props = target as unknown as ComponentProps<typeof Link>
  return (
    <DropdownMenuItem asChild>
      <Link preload={false} {...props}>
        {children}
      </Link>
    </DropdownMenuItem>
  )
}

function targets(slug: string, wiki?: string): Record<string, Target> {
  if (wiki) {
    return {
      edit: { to: '/$wikiId/$page/edit', params: { wikiId: wiki, page: slug } },
      history: {
        to: '/$wikiId/$page/history',
        params: { wikiId: wiki, page: slug },
      },
      comments: {
        to: '/$wikiId/$page/comments',
        params: { wikiId: wiki, page: slug },
      },
      search: { to: '/$wikiId/search', params: { wikiId: wiki } },
      tags: { to: '/$wikiId/tags', params: { wikiId: wiki } },
      changes: { to: '/$wikiId/changes', params: { wikiId: wiki } },
      create: { to: '/$wikiId/new', params: { wikiId: wiki } },
      settings: { to: '/$wikiId/settings', params: { wikiId: wiki } },
    }
  }
  return {
    edit: { to: '/$page/edit', params: { page: slug } },
    history: { to: '/$page/history', params: { page: slug } },
    comments: { to: '/$page/comments', params: { page: slug } },
    search: { to: '/search' },
    tags: { to: '/tags' },
    changes: { to: '/changes' },
    create: { to: '/new' },
    settings: { to: '/settings' },
  }
}

function Trigger() {
  const { t } = useLingui()
  return (
    <DropdownMenuTrigger asChild>
      <Button
        variant='ghost'
        size='icon'
        aria-label={t`Page actions`}
        className='size-11 md:size-9'
      >
        <Ellipsis className='size-4' />
      </Button>
    </DropdownMenuTrigger>
  )
}

interface PageActionsMenuProps {
  slug: string
  wiki?: string
  permissions: WikiPermissions
  comments: number
  unsubscribable: boolean
  unsubscribing: boolean
  onRename: () => void
  onDelete: () => void
  onLink: () => void
  onUnsubscribe: () => void
  onRss: (mode: 'changes' | 'comments' | 'all') => void
  onRevoke: () => void
}

export function PageActionsMenu({
  slug,
  wiki,
  permissions,
  comments,
  unsubscribable,
  unsubscribing,
  onRename,
  onDelete,
  onLink,
  onUnsubscribe,
  onRss,
  onRevoke,
}: PageActionsMenuProps) {
  const { t } = useLingui()
  const to = targets(slug, wiki)

  return (
    <DropdownMenu>
      <Trigger />
      <DropdownMenuContent align='end'>
        <DropdownMenuLabel>
          <Trans>Page</Trans>
        </DropdownMenuLabel>
        {permissions.edit && (
          <MenuLink target={to.edit}>
            <Pencil className='size-4' />
            <Trans>Edit</Trans>
          </MenuLink>
        )}
        {permissions.edit && (
          <DropdownMenuItem onSelect={onRename}>
            <FileEdit className='size-4' />
            <Trans>Rename</Trans>
          </DropdownMenuItem>
        )}
        <MenuLink target={to.history}>
          <History className='size-4' />
          <Trans>History</Trans>
        </MenuLink>
        <MenuLink target={to.comments}>
          <MessageSquare className='size-4' />
          {plural(comments, { one: '1 comment', other: '# comments' })}
        </MenuLink>
        {permissions.delete && (
          <DropdownMenuItem onSelect={onDelete}>
            <Trash2 className='size-4' />
            <Trans>Delete</Trans>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>
          <Trans>Wiki</Trans>
        </DropdownMenuLabel>
        <MenuLink target={to.search}>
          <Search className='size-4' />
          <Trans>Search</Trans>
        </MenuLink>
        <MenuLink target={to.tags}>
          <Tags className='size-4' />
          <Trans>Tags</Trans>
        </MenuLink>
        <MenuLink target={to.changes}>
          <History className='size-4' />
          <Trans>Recent changes</Trans>
        </MenuLink>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Rss className='me-2 size-4' />
            <Trans>RSS feed</Trans>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onSelect={() => onRss('changes')}>
              <Trans>Changes</Trans>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onRss('comments')}>
              <Trans>Comments</Trans>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onRss('all')}>
              <Trans>Changes and comments</Trans>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onRevoke}>
              <Trans>Revoke access</Trans>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {permissions.edit && (
          <MenuLink target={to.create}>
            <FilePlus className='size-4' />
            <Trans>New page</Trans>
          </MenuLink>
        )}
        {permissions.manage && (
          <DropdownMenuItem onSelect={onLink}>
            <LinkIcon className='size-4' />
            <Trans>Link</Trans>
          </DropdownMenuItem>
        )}
        {permissions.manage && (
          <MenuLink target={to.settings}>
            <Settings className='size-4' />
            <Trans>Settings</Trans>
          </MenuLink>
        )}
        {unsubscribable && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onUnsubscribe} disabled={unsubscribing}>
              <LogOut className='size-4' />
              {unsubscribing ? t`Unsubscribing...` : t`Unsubscribe`}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface PageMissingMenuProps {
  slug: string
  wiki?: string
  permissions: WikiPermissions
  onLink: () => void
}

// The menu shown when the slug names no page. Same two contexts, same
// single definition.
export function PageMissingMenu({
  slug,
  wiki,
  permissions,
  onLink,
}: PageMissingMenuProps) {
  const to = targets(slug, wiki)
  return (
    <DropdownMenu>
      <Trigger />
      <DropdownMenuContent align='end'>
        {permissions.edit && (
          <MenuLink target={to.edit}>
            <FilePlus className='size-4' />
            <Trans>Create this page</Trans>
          </MenuLink>
        )}
        {permissions.edit && (
          <MenuLink target={to.create}>
            <FilePlus className='size-4' />
            <Trans>New page</Trans>
          </MenuLink>
        )}
        {permissions.manage && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onLink}>
              <LinkIcon className='size-4' />
              <Trans>Link</Trans>
            </DropdownMenuItem>
            <MenuLink target={to.settings}>
              <Settings className='size-4' />
              <Trans>Wiki settings</Trans>
            </MenuLink>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
