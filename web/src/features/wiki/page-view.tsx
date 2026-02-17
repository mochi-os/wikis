import { type MouseEvent, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Link } from '@tanstack/react-router'
import type { WikiPage } from '@/types/wiki'
import { Button, EmptyState, Skeleton, Separator, cn } from '@mochi/common'
import { ChevronDown, Edit, FileQuestion, ListTree } from 'lucide-react'
import { useWikiBaseURLOptional } from '@/context/wiki-base-url-context'
import { usePermissions } from '@/context/wiki-context'
import { MarkdownContent } from './markdown-content'
import { extractTocHeadings, type TocHeading } from './markdown-content.utils'
import { TagManager } from './tag-manager'

interface PageViewProps {
  page: WikiPage
  missingLinks?: string[]
}

function findScrollParent(element: HTMLElement | null): HTMLElement | Window {
  let parent = element?.parentElement

  while (parent) {
    const style = window.getComputedStyle(parent)
    if (/(auto|scroll)/.test(style.overflowY)) {
      return parent
    }
    parent = parent.parentElement
  }

  return window
}

function TableOfContents({
  headings,
  activeHeadingId,
  onHeadingClick,
  currentPathWithQuery,
  mobile = false,
}: {
  headings: TocHeading[]
  activeHeadingId?: string
  onHeadingClick?: (event: MouseEvent<HTMLAnchorElement>, id: string) => void
  currentPathWithQuery: string
  mobile?: boolean
}) {
  const content = (
    <nav aria-label='Table of contents' className='space-y-1'>
      {headings.map((heading) => (
        <a
          key={heading.id}
          href={`${currentPathWithQuery}#${heading.id}`}
          onClick={(event) => onHeadingClick?.(event, heading.id)}
          aria-current={activeHeadingId === heading.id ? 'location' : undefined}
          className={cn(
            'text-muted-foreground hover:text-foreground block truncate rounded-md px-2 py-1 text-sm transition-colors',
            activeHeadingId === heading.id &&
              'text-foreground bg-primary/10 font-medium',
            heading.level === 3 && 'pl-5',
            heading.level === 4 && 'pl-8'
          )}
        >
          {heading.text}
        </a>
      ))}
    </nav>
  )

  if (mobile) {
    return (
      <details className='bg-surface-1 group mb-4 rounded-lg border lg:hidden'>
        <summary className='flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2'>
          <span className='flex items-center gap-2 text-sm font-medium'>
            <ListTree className='text-muted-foreground size-4' />
            On this page
          </span>
          <ChevronDown className='text-muted-foreground size-4 transition-transform group-open:rotate-180' />
        </summary>
        <div className='border-t px-2 py-2'>{content}</div>
      </details>
    )
  }

  return (
    <aside className='hidden lg:block'>
      <div className='bg-surface-1 sticky top-20 rounded-lg border p-3'>
        <p className='mb-2 flex items-center gap-2 text-sm font-semibold'>
          <ListTree className='text-muted-foreground size-4' />
          On this page
        </p>
        {content}
      </div>
    </aside>
  )
}

export function PageView({ page, missingLinks }: PageViewProps) {
  const headings = extractTocHeadings(page.content)
  const hasToc = headings.length > 0
  const currentPathWithQuery = `${window.location.pathname}${window.location.search}`
  const [activeHeadingId, setActiveHeadingId] = useState<string | undefined>(
    headings[0]?.id
  )

  useEffect(() => {
    setActiveHeadingId(headings[0]?.id)
  }, [headings])

  useEffect(() => {
    if (!hasToc) {
      return
    }

    const headingIds = headings.map((heading) => heading.id)
    const headingElements = headingIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null)

    const syncFromHash = () => {
      const hashId = window.location.hash.replace(/^#/, '')
      if (hashId && headingIds.includes(hashId)) {
        setActiveHeadingId(hashId)
      }
    }

    const updateActiveHeadingFromScroll = () => {
      if (headingElements.length === 0) {
        return
      }

      const viewportLimit = Math.max(180, window.innerHeight * 0.8)
      const visibleHeadings = headingElements.filter((heading) => {
        const top = heading.getBoundingClientRect().top
        return top >= 0 && top <= viewportLimit
      })

      if (visibleHeadings.length > 0) {
        setActiveHeadingId(visibleHeadings[visibleHeadings.length - 1].id)
        return
      }

      const activationOffset = 120
      let currentId = headingElements[0].id

      for (const heading of headingElements) {
        if (heading.getBoundingClientRect().top - activationOffset <= 0) {
          currentId = heading.id
        } else {
          break
        }
      }

      setActiveHeadingId(currentId)
    }

    syncFromHash()
    updateActiveHeadingFromScroll()

    if (headingElements.length === 0) {
      window.addEventListener('hashchange', syncFromHash)
      return () => {
        window.removeEventListener('hashchange', syncFromHash)
      }
    }

    const scrollParent = findScrollParent(headingElements[0])
    const scrollTarget = scrollParent === window ? window : scrollParent

    scrollTarget.addEventListener('scroll', updateActiveHeadingFromScroll, {
      passive: true,
    })
    window.addEventListener('resize', updateActiveHeadingFromScroll)

    window.addEventListener('hashchange', syncFromHash)

    return () => {
      scrollTarget.removeEventListener('scroll', updateActiveHeadingFromScroll)
      window.removeEventListener('resize', updateActiveHeadingFromScroll)
      window.removeEventListener('hashchange', syncFromHash)
    }
  }, [hasToc, headings])

  const handleTocHeadingClick = (
    event: MouseEvent<HTMLAnchorElement>,
    headingId: string
  ) => {
    event.preventDefault()

    const targetHeading = document.getElementById(headingId)
    if (!targetHeading) {
      return
    }

    setActiveHeadingId(headingId)
    targetHeading.scrollIntoView({ behavior: 'auto', block: 'start' })
    window.history.replaceState(
      null,
      '',
      `${currentPathWithQuery}#${headingId}`
    )
  }

  return (
    <article className='space-y-5'>
      <Separator />

      <div
        className={cn(
          'grid gap-8',
          hasToc && 'lg:grid-cols-[minmax(0,1fr)_240px]'
        )}
      >
        <div className='min-w-0'>
          {hasToc && (
            <TableOfContents
              headings={headings}
              activeHeadingId={activeHeadingId}
              onHeadingClick={handleTocHeadingClick}
              currentPathWithQuery={currentPathWithQuery}
              mobile
            />
          )}

          <MarkdownContent
            content={page.content}
            missingLinks={missingLinks}
            className='max-w-[80ch]'
            toc
          />
        </div>

        {hasToc && (
          <TableOfContents
            headings={headings}
            activeHeadingId={activeHeadingId}
            onHeadingClick={handleTocHeadingClick}
            currentPathWithQuery={currentPathWithQuery}
          />
        )}
      </div>

      <Separator />

      <footer className='bg-surface-1 flex flex-wrap items-center justify-between gap-4 rounded-lg border px-3 py-2'>
        <TagManager slug={page.slug} tags={page.tags} />

        <div className='text-muted-foreground flex items-center gap-2 text-xs'>
          <span className='bg-background text-foreground rounded border px-1.5 py-0.5 font-mono'>
            v{page.version}
          </span>
          <time dateTime={new Date(page.updated * 1000).toISOString()}>
            Updated{' '}
            {format(new Date(page.updated * 1000), 'yyyy-MM-dd HH:mm:ss')}
          </time>
        </div>
      </footer>
    </article>
  )
}

interface PageNotFoundProps {
  slug: string
  wikiId?: string
}

export function PageNotFound({ slug, wikiId: wikiIdProp }: PageNotFoundProps) {
  // Get permissions from WikiContext (entity context) or WikiBaseURLContext ($wikiId context)
  const wikiContextPermissions = usePermissions()
  const wikiBaseURLContext = useWikiBaseURLOptional()
  const permissions = wikiBaseURLContext?.permissions ?? wikiContextPermissions

  // Only use wikiId routes if explicitly passed (class context like /wikis/$wikiId/...)
  // In entity context (/<entity>/...), the basepath already includes the entity, so use $page routes
  const wikiId = wikiIdProp

  return (
    <EmptyState
      icon={FileQuestion}
      title='Page not found'
      description={`The page "${slug}" does not exist yet.`}
    >
      {permissions.edit && (
        <Button asChild>
          {wikiId ? (
            <Link to='/$wikiId/$page/edit' params={{ wikiId, page: slug }}>
              <Edit className='mr-2 h-4 w-4' />
              Create this page
            </Link>
          ) : (
            <Link to='/$page/edit' params={{ page: slug }}>
              <Edit className='mr-2 h-4 w-4' />
              Create this page
            </Link>
          )}
        </Button>
      )}
    </EmptyState>
  )
}

export function PageViewSkeleton() {
  return (
    <article className='space-y-4'>
      <Separator />
      <div className='space-y-4'>
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-3/4' />
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-5/6' />
      </div>
      <Separator />
      <Skeleton className='h-5 w-24' />
    </article>
  )
}
