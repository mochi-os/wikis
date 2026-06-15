import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { Clock, ArrowLeft, RotateCcw, GitCompare } from 'lucide-react'
import { Button, useFormat, Badge, Separator, Skeleton, EntityAvatar, getAppPath } from '@mochi/web'
import { diffLines } from 'diff'
import type { RevisionDetail } from '@/types/wiki'
import { usePageRevision } from '@/hooks/use-wiki'
import { MarkdownContent } from './markdown-content'

interface RevisionViewProps {
  slug: string
  revision: RevisionDetail
  currentVersion: number
  wikiId?: string
}

function DiffView({ oldContent, newContent }: { oldContent: string; newContent: string }) {
  const changes = diffLines(oldContent, newContent)
  return (
    <div className="overflow-x-auto rounded-lg border font-mono text-sm">
      {changes.map((part, i) => {
        const lines = part.value.replace(/\n$/, '').split('\n')
        const bg = part.added
          ? 'bg-success/10 dark:bg-success/15'
          : part.removed
            ? 'bg-destructive/10 dark:bg-destructive/15'
            : ''
        const prefix = part.added ? '+' : part.removed ? '-' : ' '
        const textColor = part.added
          ? 'text-success'
          : part.removed
            ? 'text-destructive'
            : 'text-muted-foreground'
        return lines.map((line, j) => (
          <div key={`${i}-${j}`} className={`flex gap-2 px-3 py-0.5 ${bg}`}>
            <span className={`w-4 shrink-0 select-none ${textColor}`}>{prefix}</span>
            <span className={textColor}>{line || ' '}</span>
          </div>
        ))
      })}
    </div>
  )
}

export function RevisionView({
  slug,
  revision,
  currentVersion,
  wikiId,
}: RevisionViewProps) {
  const { formatTimestamp } = useFormat()
  const isCurrentVersion = revision.version === currentVersion
  const [showDiff, setShowDiff] = useState(false)
  const hasPrevious = revision.version > 1
  const authorLabel = revision.name

  // Fetch the previous revision when diff mode is active
  const { data: prevData, isLoading: prevLoading } = usePageRevision(
    slug,
    revision.version - 1,
    { enabled: showDiff && hasPrevious }
  )

  return (
    <article className="space-y-6">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant={isCurrentVersion ? 'default' : 'secondary'}>
                <Trans>Version {revision.version}</Trans>
              </Badge>
              {isCurrentVersion && (
                <Badge variant="outline"><Trans>Current</Trans></Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              {revision.title}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasPrevious && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDiff(!showDiff)}
              >
                <GitCompare className="me-2 h-4 w-4" />
                {showDiff ? <Trans>Show page</Trans> : <Trans>Compare changes</Trans>}
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              {wikiId ? (
                <Link to="/$wikiId/$page/history" params={{ wikiId, page: slug }}>
                  <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
                  <Trans>Back to history</Trans>
                </Link>
              ) : (
                <Link to="/$page/history" params={{ page: slug }}>
                  <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
                  <Trans>Back to history</Trans>
                </Link>
              )}
            </Button>
            {!isCurrentVersion && (
              <Button variant="outline" size="sm" asChild>
                {wikiId ? (
                  <Link to="/$wikiId/$page/revert" params={{ wikiId, page: slug }} search={{ version: revision.version }}>
                    <RotateCcw className="me-2 h-4 w-4" />
                    <Trans>Revert to this version</Trans>
                  </Link>
                ) : (
                  <Link to="/$page/revert" params={{ page: slug }} search={{ version: revision.version }}>
                    <RotateCcw className="me-2 h-4 w-4" />
                    <Trans>Revert to this version</Trans>
                  </Link>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Meta info */}
        <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {formatTimestamp(revision.created)}
          </span>
          <span className="inline-flex items-center gap-2">
            <EntityAvatar
              src={wikiId ? `${getAppPath()}/${wikiId}/-/revision/${revision.id}/asset/avatar` : undefined}
              styleUrl={wikiId ? `${getAppPath()}/${wikiId}/-/revision/${revision.id}/asset/style` : undefined}
              fingerprint={wikiId ? undefined : revision.author}
              seed={revision.author}
              name={authorLabel}
              size="xs"
            />
            <span className="font-medium" title={revision.author}>{authorLabel}</span>
          </span>
        </div>

        {revision.comment && (
          <p className="text-muted-foreground italic">"{revision.comment}"</p>
        )}
      </header>

      <Separator />

      {/* Content or Diff */}
      {showDiff && hasPrevious ? (
        prevLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
        ) : prevData?.revision ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">
              <Trans>Changes from version {prevData.revision.version} → {revision.version}</Trans>
            </p>
            <DiffView oldContent={prevData.revision.content} newContent={revision.content} />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            <Trans>Could not load previous version for comparison.</Trans>
          </p>
        )
      ) : (
        <MarkdownContent content={revision.content} />
      )}
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
