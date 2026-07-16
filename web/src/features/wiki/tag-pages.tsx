// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { Link } from '@tanstack/react-router'
import { plural, t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { Tag as TagIcon, FileText, ArrowLeft } from 'lucide-react'
import { Badge, Button, EmptyState, useFormat, Separator, Skeleton } from '@mochi/web'
import type { TagPage } from '@/types/wiki'

interface TagPagesProps {
  tag: string
  pages: TagPage[]
}

export function TagPages({ tag, pages }: TagPagesProps) {
  const { formatTimestamp } = useFormat()
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <TagIcon className="h-6 w-6" />
          <h1 className="text-2xl font-bold">
            <Trans>
              Pages tagged{' '}
              <Badge variant="secondary" className="ms-1 text-lg">
                {tag}
              </Badge>
            </Trans>
          </h1>
        </div>
        <Button variant="outline" asChild>
          <Link preload={false} to="/tags">
            <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
            <Trans>All tags</Trans>
          </Link>
        </Button>
      </div>

      <p className="text-muted-foreground">
        <Trans>{plural(pages.length, { one: '# page', other: '# pages' })} with this tag.</Trans>
      </p>

      <Separator />

      {/* Pages list */}
      {pages.length === 0 ? (
        <EmptyState
          icon={TagIcon}
          title={t`No pages found with this tag`}
          description={t`Try a different tag.`}
          className="py-8"
        />
      ) : (
        <div className="space-y-2">
          {pages.map((page) => (
            <Link preload={false}
              key={page.page}
              to="/$page"
              params={{ page: page.page }}
              className="hover:bg-hover group flex items-center gap-4 rounded-lg border p-4 transition-colors"
            >
              <FileText className="text-muted-foreground h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold group-hover:underline">
                  {page.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  <Trans>Updated {formatTimestamp(page.updated)}</Trans>
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function TagPagesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <Skeleton className="h-5 w-32" />
      <Separator />
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
            <Skeleton className="h-5 w-5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
