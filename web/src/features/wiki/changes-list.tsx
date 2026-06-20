// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { Trans } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import { History } from 'lucide-react'
import { EntityAvatar, useFormat, Separator, Skeleton, EmptyState, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, getAppPath, Button } from '@mochi/web'
import type { Change } from '@/types/wiki'
import { t } from '@lingui/core/macro'

interface ChangesListProps {
  changes: Change[]
  wikiId?: string
  total?: number
  offset?: number
  onLoadMore?: () => void
}

export function ChangesList({ changes, wikiId, total, offset = 0, onLoadMore }: ChangesListProps) {
  const { formatTimestamp } = useFormat()
  const hasMore = total !== undefined && (offset + changes.length) < total
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        <Trans>Recent edits across all pages in this wiki.</Trans>
      </p>

      <Separator />

      {/* Changes table */}
      {changes.length === 0 ? (
        <div className="py-12">
          <EmptyState
            icon={History}
            title={t`No changes yet`}
            description={t`Changes will appear here when pages are edited.`}
          />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Trans>Page</Trans></TableHead>
              <TableHead><Trans>Version</Trans></TableHead>
              <TableHead><Trans>Author</Trans></TableHead>
              <TableHead><Trans>Date</Trans></TableHead>
              <TableHead><Trans>Comment</Trans></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {changes.map((change) => {
              const authorLabel = change.name
              return (
                <TableRow key={change.id}>
                  <TableCell>
                    {wikiId ? (
                      <Link
                        to="/$wikiId/$page"
                        params={{ wikiId, page: change.slug }}
                        className="font-medium hover:underline"
                      >
                        {change.title}
                      </Link>
                    ) : (
                      <Link
                        to="/$page"
                        params={{ page: change.slug }}
                        className="font-medium hover:underline"
                      >
                        {change.title}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="font-mono">{change.version}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <EntityAvatar
                        src={wikiId ? `${getAppPath()}/${wikiId}/-/revision/${change.id}/asset/avatar` : undefined}
                        styleUrl={wikiId ? `${getAppPath()}/${wikiId}/-/revision/${change.id}/asset/style` : undefined}
                        fingerprint={wikiId ? undefined : change.author}
                        seed={change.author}
                        name={authorLabel}
                        size="xs"
                      />
                      <span title={change.author}>{authorLabel}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatTimestamp(change.created)}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-48 truncate">
                    {change.comment || '-'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
      {hasMore && onLoadMore && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" size="sm" onClick={onLoadMore}>
            <Trans>Load more</Trans>
          </Button>
        </div>
      )}
    </div>
  )
}

export function ChangesListSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-64" />
      <Separator />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
