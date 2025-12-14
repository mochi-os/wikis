import { format } from 'date-fns'
import { History, Eye, RotateCcw, ArrowLeft } from 'lucide-react'
import { Button } from '@mochi/common'
import { getRouterBasepath } from '@mochi/common'
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
import type { Revision } from '@/types/wiki'

interface PageHistoryProps {
  slug: string
  revisions: Revision[]
  currentVersion: number
}

export function PageHistory({
  slug,
  revisions,
  currentVersion,
}: PageHistoryProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <History className="h-6 w-6" />
          <h1 className="text-2xl font-bold">History</h1>
        </div>
        <Button variant="outline" asChild>
          <a href={`${getRouterBasepath()}${slug}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to page
          </a>
        </Button>
      </div>

      <p className="text-muted-foreground">
        Viewing history for <strong>{slug}</strong>, current version {currentVersion}
      </p>

      <Separator />

      {/* Revisions table */}
      {revisions.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          No revisions found.
        </p>
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
                  <a
                    href={`${getRouterBasepath()}${slug}/history/${revision.version}`}
                    className="text-primary hover:underline"
                  >
                    {revision.version}
                  </a>
                </TableCell>
                <TableCell>
                  <a
                    href={`${getRouterBasepath()}${slug}/history/${revision.version}`}
                    className="text-primary hover:underline"
                  >
                    {revision.title}
                  </a>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {revision.name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(revision.created * 1000), 'PPp')}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-48 truncate">
                  {revision.comment || '-'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" asChild title="View">
                      <a href={`${getRouterBasepath()}${slug}/history/${revision.version}`}>
                        <Eye className="h-4 w-4" />
                      </a>
                    </Button>
                    {revision.version !== currentVersion && (
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        title="Revert to this version"
                      >
                        <a href={`${getRouterBasepath()}${slug}/revert?version=${revision.version}`}>
                          <RotateCcw className="h-4 w-4" />
                        </a>
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-9 w-32" />
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
