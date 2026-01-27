import { format } from 'date-fns'
import { Edit, FileQuestion } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button } from '@mochi/common'
import { Skeleton } from '@mochi/common'
import { Separator } from '@mochi/common'
import type { WikiPage } from '@/types/wiki'
import { MarkdownContent } from './markdown-content'
import { TagManager } from './tag-manager'
import { usePermissions } from '@/context/wiki-context'
import { useWikiBaseURLOptional } from '@/context/wiki-base-url-context'

interface PageViewProps {
  page: WikiPage
  missingLinks?: string[]
}

export function PageView({ page, missingLinks }: PageViewProps) {
  return (
    <article className="space-y-4">
      <Separator />
      <MarkdownContent content={page.content} missingLinks={missingLinks} />
      <Separator />
      <div className="flex items-center justify-between gap-4">
        <TagManager slug={page.slug} tags={page.tags} />
        <span className="text-muted-foreground text-xs shrink-0">
          #{page.version}, {format(new Date(page.updated * 1000), 'yyyy-MM-dd HH:mm:ss')}
        </span>
      </div>
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
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileQuestion className="text-muted-foreground mb-4 h-16 w-16" />
      <h1 className="mb-2 text-2xl font-bold">Page not found</h1>
      <p className="text-muted-foreground mb-6">
        The page "{slug}" does not exist yet.
      </p>
      {permissions.edit && (
        <Button asChild>
          {wikiId ? (
            <Link to="/$wikiId/$page/edit" params={{ wikiId, page: slug }}>
              <Edit className="mr-2 h-4 w-4" />
              Create this page
            </Link>
          ) : (
            <Link to="/$page/edit" params={{ page: slug }}>
              <Edit className="mr-2 h-4 w-4" />
              Create this page
            </Link>
          )}
        </Button>
      )}
    </div>
  )
}

export function PageViewSkeleton() {
  return (
    <article className="space-y-4">
      <Separator />
      <div className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <Separator />
      <Skeleton className="h-5 w-24" />
    </article>
  )
}
