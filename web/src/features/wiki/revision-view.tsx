// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { RevisionDetail } from '@/types/wiki'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Button,
  DiffFileView,
  DiffViewToggle,
  GeneralError,
  type DiffViewStyle,
  useFormat,
  useScreenSize,
  useShellStorage,
  Badge,
  Separator,
  Skeleton,
  StickyBar,
  EntityAvatar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  getAppPath,
} from '@mochi/web'
import { Clock, ArrowLeft, RotateCcw, GitCompare } from 'lucide-react'
import { usePageRevision, usePageVersions } from '@/hooks/use-wiki'
import { MarkdownContent } from './markdown-content'
import {
  compareOptions,
  compareOrder,
  defaultCompare,
  pageDiff,
  pageWords,
} from './revision-compare'

// Where the choice between one column and two is remembered.
const COMPARE_STYLE_KEY = 'wikis.compare'

interface RevisionViewProps {
  slug: string
  revision: RevisionDetail
  currentVersion: number
  wikiId?: string
}

function DiffView({
  oldContent,
  newContent,
  viewStyle,
}: {
  oldContent: string
  newContent: string
  viewStyle: DiffViewStyle
}) {
  const file = useMemo(
    () => pageDiff(oldContent, newContent),
    [oldContent, newContent]
  )
  if (!file) {
    return (
      <p className='text-muted-foreground text-sm'>
        <Trans>No changes to display</Trans>
      </p>
    )
  }
  return (
    <DiffFileView
      file={file}
      viewStyle={viewStyle}
      words={pageWords}
      hunkHeaders={false}
      prose
      textSize='sm'
    />
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
  const { t } = useLingui()
  const [showDiff, setShowDiff] = useState(false)
  // Two columns leave each side too narrow to read on a phone, so there the
  // comparison stays in one column and the switch is not offered.
  const { isMobile } = useScreenSize()
  const [savedStyle, setSavedStyle] = useShellStorage<DiffViewStyle>(
    COMPARE_STYLE_KEY,
    'unified'
  )
  const viewStyle = isMobile ? 'unified' : savedStyle
  const authorLabel = revision.name

  // A page past its first version has an earlier one to compare with.
  const canCompare = currentVersion > 1
  // The versions that exist, read once the comparison is opened. They are not
  // every number up to the current one: see usePageVersions.
  const {
    data: versions = [],
    isLoading: versionsLoading,
    isError: versionsError,
    error: versionsErrorValue,
    refetch: retryVersions,
  } = usePageVersions(slug, { enabled: showDiff && canCompare })

  // The pick is kept with the version it was made for: the route reuses this
  // component from one version to the next, and a pick made on another version
  // could name the version now on screen.
  const [picked, setPicked] = useState<{
    page: string
    version: number
    other: number
  }>()
  const pageKey = `${wikiId ?? ''}\0${slug}`
  // 0 until the versions arrive, and when the page has no other version.
  const other =
    picked?.page === pageKey &&
    picked.version === revision.version &&
    versions.includes(picked.other)
      ? picked.other
      : defaultCompare(revision.version, versions)
  // Read through the object below: a member access keeps a message's
  // placeholders positional, so both messages here stay the ones the
  // catalogs already translate.
  const range = compareOrder(revision.version, other)
  const options = compareOptions(revision.version, versions).map((version) => ({
    version,
  }))

  // Fetch the other revision when diff mode is active and there is one
  const {
    data: otherData,
    isLoading: otherLoading,
    isError: otherError,
    error: otherErrorValue,
    refetch: retryOther,
  } = usePageRevision(slug, other, { enabled: showDiff && other > 0 })

  return (
    <article className='space-y-6'>
      {/* Header */}
      <header className='space-y-4'>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <div className='mb-2 flex items-center gap-2'>
              <Badge variant={isCurrentVersion ? 'default' : 'secondary'}>
                <Trans>Version {revision.version}</Trans>
              </Badge>
              {isCurrentVersion && (
                <Badge variant='outline'>
                  <Trans>Current</Trans>
                </Badge>
              )}
            </div>
            <h1 className='text-3xl font-bold tracking-tight'>
              {revision.title}
            </h1>
          </div>
          <div className='flex flex-wrap gap-2'>
            {canCompare && (
              <Button
                variant='outline'
                size='sm'
                onClick={() => setShowDiff(!showDiff)}
              >
                <GitCompare className='me-2 h-4 w-4' />
                {showDiff ? (
                  <Trans>Show page</Trans>
                ) : (
                  <Trans>Compare changes</Trans>
                )}
              </Button>
            )}
            <Button variant='outline' size='sm' asChild>
              {wikiId ? (
                <Link
                  preload={false}
                  to='/$wikiId/$page/history'
                  params={{ wikiId, page: slug }}
                >
                  <ArrowLeft className='me-2 h-4 w-4 rtl:rotate-180' />
                  <Trans>Back to history</Trans>
                </Link>
              ) : (
                <Link
                  preload={false}
                  to='/$page/history'
                  params={{ page: slug }}
                >
                  <ArrowLeft className='me-2 h-4 w-4 rtl:rotate-180' />
                  <Trans>Back to history</Trans>
                </Link>
              )}
            </Button>
            {!isCurrentVersion && (
              <Button variant='outline' size='sm' asChild>
                {wikiId ? (
                  <Link
                    preload={false}
                    to='/$wikiId/$page/revert'
                    params={{ wikiId, page: slug }}
                    search={{ version: revision.version }}
                  >
                    <RotateCcw className='me-2 h-4 w-4' />
                    <Trans>Revert to this version</Trans>
                  </Link>
                ) : (
                  <Link
                    preload={false}
                    to='/$page/revert'
                    params={{ page: slug }}
                    search={{ version: revision.version }}
                  >
                    <RotateCcw className='me-2 h-4 w-4' />
                    <Trans>Revert to this version</Trans>
                  </Link>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Meta info */}
        <div className='text-muted-foreground flex flex-wrap items-center gap-4 text-sm'>
          <span className='flex items-center gap-1'>
            <Clock className='h-4 w-4' />
            {formatTimestamp(revision.created)}
          </span>
          <span className='inline-flex items-center gap-2'>
            <EntityAvatar
              src={
                wikiId
                  ? `${getAppPath()}/${wikiId}/-/revision/${revision.id}/asset/avatar`
                  : undefined
              }
              styleUrl={
                wikiId
                  ? `${getAppPath()}/${wikiId}/-/revision/${revision.id}/asset/style`
                  : undefined
              }
              fingerprint={wikiId ? undefined : revision.author}
              seed={revision.author}
              name={authorLabel}
              size='xs'
            />
            <span className='font-medium'>{authorLabel}</span>
          </span>
        </div>

        {revision.comment && (
          <p className='text-muted-foreground italic'>"{revision.comment}"</p>
        )}
      </header>

      <Separator />

      {/* Content or Diff */}
      {showDiff && canCompare ? (
        <div className='space-y-2'>
          {/* Stays in view while a long page scrolls under it, so the view and
              the version can be changed from anywhere in the comparison. The
              shared StickyBar pins it under the page header. -mt-2 with py-2
              keeps the row where it was and lets its background cover the
              lines passing beneath. Left out until there is a version to
              name. */}
          {other > 0 && (
            <StickyBar className='-mt-2 flex flex-wrap items-center justify-between gap-2 py-2'>
              <p className='text-muted-foreground text-xs'>
                <Trans>
                  Changes from version {range.from} → {range.to}
                </Trans>
              </p>
              <div className='flex flex-wrap items-center gap-2'>
                {!isMobile && (
                  <DiffViewToggle value={viewStyle} onChange={setSavedStyle} />
                )}
                <Select
                  value={String(other)}
                  onValueChange={(value) =>
                    setPicked({
                      page: pageKey,
                      version: revision.version,
                      other: Number(value),
                    })
                  }
                >
                  <SelectTrigger size='sm' aria-label={t`Version`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem
                        key={option.version}
                        value={String(option.version)}
                      >
                        <Trans>Version {option.version}</Trans>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </StickyBar>
          )}
          {versionsError ? (
            <GeneralError
              error={versionsErrorValue}
              minimal
              mode='inline'
              reset={() => void retryVersions()}
            />
          ) : versionsLoading || otherLoading ? (
            <div className='space-y-2'>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className='h-5 w-full' />
              ))}
            </div>
          ) : otherData?.revision ? (
            <DiffView
              viewStyle={viewStyle}
              oldContent={
                range.from === other
                  ? otherData.revision.content
                  : revision.content
              }
              newContent={
                range.to === other
                  ? otherData.revision.content
                  : revision.content
              }
            />
          ) : otherError ? (
            <GeneralError
              error={otherErrorValue}
              minimal
              mode='inline'
              reset={() => void retryOther()}
            />
          ) : null}
        </div>
      ) : (
        <MarkdownContent content={revision.content} />
      )}
    </article>
  )
}

export function RevisionViewSkeleton() {
  return (
    <article className='space-y-6'>
      <header className='space-y-4'>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <div className='mb-2 flex gap-2'>
              <Skeleton className='h-6 w-24' />
            </div>
            <Skeleton className='h-9 w-64' />
          </div>
          <div className='flex gap-2'>
            <Skeleton className='h-9 w-36' />
            <Skeleton className='h-9 w-40' />
          </div>
        </div>
        <div className='flex gap-4'>
          <Skeleton className='h-5 w-48' />
          <Skeleton className='h-5 w-32' />
        </div>
      </header>
      <Separator />
      <div className='space-y-4'>
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-3/4' />
      </div>
    </article>
  )
}
