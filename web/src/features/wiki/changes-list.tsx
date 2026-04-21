import { History } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { EntityAvatar, useFormat, Separator, Skeleton, EmptyState, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@mochi/web'
import type { Change } from '@/types/wiki'

interface ChangesListProps {
  changes: Change[]
  wikiId?: string
}

export function ChangesList({ changes, wikiId }: ChangesListProps) {
  const { formatTimestamp } = useFormat()
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <History className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Recent changes</h1>
      </div>

      <p className="text-muted-foreground">
        Recent edits across all pages in this wiki.
      </p>

      <Separator />

      {/* Changes table */}
      {changes.length === 0 ? (
        <div className="py-12">
          <EmptyState
            icon={History}
            title="No changes yet"
            description="Changes will appear here when pages are edited."
          />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Page</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Comment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {changes.map((change) => (
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
                      fingerprint={change.author}
                      name={change.name}
                      size={20}
                    />
                    {change.name}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatTimestamp(change.created)}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-48 truncate">
                  {change.comment || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

export function ChangesListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-6" />
        <Skeleton className="h-8 w-48" />
      </div>
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
