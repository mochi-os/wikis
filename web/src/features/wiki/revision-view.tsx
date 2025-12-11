import { format } from 'date-fns'
import { Clock, ArrowLeft, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import type { RevisionDetail } from '@/types/wiki'
import { MarkdownContent } from './markdown-content'

interface RevisionViewProps {
  slug: string
  revision: RevisionDetail
  currentVersion: number
}

export function RevisionView({
  slug,
  revision,
  currentVersion,
}: RevisionViewProps) {
  const isCurrentVersion = revision.version === currentVersion

  return (
    <article className="space-y-6">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant={isCurrentVersion ? 'default' : 'secondary'}>
                Version {revision.version}
              </Badge>
              {isCurrentVersion && (
                <Badge variant="outline">Current</Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              {revision.title}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`${slug}/history`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to history
              </a>
            </Button>
            {!isCurrentVersion && (
              <Button size="sm" asChild>
                <a href={`${slug}/revert?version=${revision.version}`}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Revert to this version
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Meta info */}
        <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {format(new Date(revision.created * 1000), 'PPpp')}
          </span>
          <span className="font-mono">by {revision.author.slice(0, 16)}...</span>
        </div>

        {revision.comment && (
          <p className="text-muted-foreground italic">"{revision.comment}"</p>
        )}
      </header>

      <Separator />

      {/* Content */}
      <MarkdownContent content={revision.content} />
    </article>
  )
}

export function RevisionViewSkeleton() {
  return (
    <article className="space-y-6">
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex gap-2">
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-9 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-40" />
          </div>
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-32" />
        </div>
      </header>
      <Separator />
      <div className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </article>
  )
}
