import { Link } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { Eye, History, RotateCcw } from 'lucide-react'
import { Button, EntityAvatar, EmptyState, useFormat, Separator, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, getAppPath } from '@mochi/web'
import type { Revision } from '@/types/wiki'
import { t } from '@lingui/core/macro'
import { getAuthorLabel } from './author-label'

interface PageHistoryProps {
  slug: string
  revisions: Revision[]
  currentVersion: number
  wikiId?: string
  total?: number
  offset?: number
  onLoadMore?: () => void
}

export function PageHistory({
  slug,
  revisions,
  currentVersion,
  wikiId,
  total,
  offset = 0,
  onLoadMore,
}: PageHistoryProps) {
  const { formatTimestamp } = useFormat()
  const hasMore = total !== undefined && (offset + revisions.length) < total
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        <Trans>
          Viewing history for <strong>{slug}</strong>, current version {currentVersion}
        </Trans>
      </p>

      <Separator />

      {/* Revisions table */}
      {revisions.length === 0 ? (
        <EmptyState
          icon={History}
          title={t`No revisions found`}
          className="py-8"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20"><Trans>Version</Trans></TableHead>
              <TableHead><Trans>Title</Trans></TableHead>
              <TableHead><Trans>Author</Trans></TableHead>
              <TableHead><Trans>Date</Trans></TableHead>
              <TableHead><Trans>Comment</Trans></TableHead>
              <TableHead className="w-32"><Trans>Actions</Trans></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {revisions.map((revision) => {
              const authorLabel = getAuthorLabel(revision.name, revision.author)
              return (
                <TableRow key={revision.id}>
                  <TableCell className="font-mono">
                    {wikiId ? (
                      <Link to="/$wikiId/$page/history/$version" params={{ wikiId, page: slug, version: String(revision.version) }} className="text-primary hover:underline">
                        {revision.version}
                      </Link>
                    ) : (
                      <Link to="/$page/history/$version" params={{ page: slug, version: String(revision.version) }} className="text-primary hover:underline">
                        {revision.version}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell>
                    {wikiId ? (
                      <Link to="/$wikiId/$page/history/$version" params={{ wikiId, page: slug, version: String(revision.version) }} className="text-primary hover:underline">
                        {revision.title}
                      </Link>
                    ) : (
                      <Link to="/$page/history/$version" params={{ page: slug, version: String(revision.version) }} className="text-primary hover:underline">
                        {revision.title}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <EntityAvatar
                        src={wikiId ? `${getAppPath()}/${wikiId}/-/revision/${revision.id}/asset/avatar` : undefined}
                        styleUrl={wikiId ? `${getAppPath()}/${wikiId}/-/revision/${revision.id}/asset/style` : undefined}
                        fingerprint={wikiId ? undefined : revision.author}
                        seed={revision.author}
                        name={authorLabel}
                        size="xs"
                      />
                      <span title={revision.author}>{authorLabel}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatTimestamp(revision.created)}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-48 truncate">
                    {revision.comment || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" asChild title={t({ message: 'View', context: 'action' })} aria-label={t({ message: 'View', context: 'action' })}>
                        {wikiId ? (
                          <Link to="/$wikiId/$page/history/$version" params={{ wikiId, page: slug, version: String(revision.version) }}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        ) : (
                          <Link to="/$page/history/$version" params={{ page: slug, version: String(revision.version) }}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        )}
                      </Button>
                      {revision.version !== currentVersion && (
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          title={t`Revert to this version`}
                          aria-label={t`Revert to this version`}
                        >
                          {wikiId ? (
                            <Link to="/$wikiId/$page/revert" params={{ wikiId, page: slug }} search={{ version: revision.version }}>
                              <RotateCcw className="h-4 w-4" />
                            </Link>
                          ) : (
                            <Link to="/$page/revert" params={{ page: slug }} search={{ version: revision.version }}>
                              <RotateCcw className="h-4 w-4" />
                            </Link>
                          )}
                        </Button>
                      )}
                    </div>
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

export function PageHistorySkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-64" />
      <Separator />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
