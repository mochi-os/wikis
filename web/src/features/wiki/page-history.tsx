import { Link } from '@tanstack/react-router'
import { History, Eye, RotateCcw } from 'lucide-react'
import { Button, EntityAvatar, EmptyState, useFormat, Separator, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, getAppPath } from '@mochi/web'
import type { Revision } from '@/types/wiki'

interface PageHistoryProps {
  slug: string
  revisions: Revision[]
  currentVersion: number
  wikiId?: string
}

export function PageHistory({
  slug,
  revisions,
  currentVersion,
  wikiId,
}: PageHistoryProps) {
  const { formatTimestamp } = useFormat()
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <History className="h-6 w-6" />
        <h1 className="text-2xl font-bold">History</h1>
      </div>

      <p className="text-muted-foreground">
        Viewing history for <strong>{slug}</strong>, current version {currentVersion}
      </p>

      <Separator />

      {/* Revisions table */}
      {revisions.length === 0 ? (
        <EmptyState
          icon={History}
          title="No revisions found"
          className="py-8"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Version</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {revisions.map((revision) => (
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
                      name={revision.name}
                      size={20}
                    />
                    {revision.name}
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
                    <Button variant="ghost" size="icon" asChild title="View">
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
                        title="Revert to this version"
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
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

export function PageHistorySkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-6" />
        <Skeleton className="h-8 w-40" />
      </div>
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
