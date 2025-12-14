import { format } from 'date-fns'
import { History } from 'lucide-react'
import { Separator } from '@mochi/common'
import { Skeleton } from '@mochi/common'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@mochi/common'
import type { Change } from '@/types/wiki'

interface ChangesListProps {
  changes: Change[]
}

export function ChangesList({ changes }: ChangesListProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <History className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Recent Changes</h1>
      </div>

      <p className="text-muted-foreground">
        Recent edits across all pages in this wiki.
      </p>

      <Separator />

      {/* Changes table */}
      {changes.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          No changes yet.
        </p>
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
                  <a
                    href={change.slug}
                    className="font-medium hover:underline"
                  >
                    {change.title}
                  </a>
                </TableCell>
                <TableCell className="font-mono">{change.version}</TableCell>
                <TableCell className="text-muted-foreground">
                  {change.name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(change.created * 1000), 'PPp')}
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
