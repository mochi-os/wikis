import { format } from 'date-fns'
import { Link } from '@tanstack/react-router'
import { Clock, Edit, History, FileQuestion, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'
import type { WikiPage } from '@/types/wiki'
import { MarkdownContent } from './markdown-content'
import { TagManager } from './tag-manager'

interface PageViewProps {
  page: WikiPage
}

export function PageView({ page }: PageViewProps) {
  return (
    <article className="space-y-6">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight">{page.title}</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/$page/history" params={{ page: page.slug }}>
                <History className="mr-2 h-4 w-4" />
                History
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/$page/edit" params={{ page: page.slug }}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link
                    to="/$page/delete"
                    params={{ page: page.slug }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete page
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Meta info */}
        <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Last updated {format(new Date(page.updated * 1000), 'PPP')}
          </span>
          <span>Version {page.version}</span>
        </div>

        {/* Tags */}
        <TagManager slug={page.slug} tags={page.tags} />
      </header>

      <Separator />

      {/* Content */}
      <MarkdownContent content={page.content} />
    </article>
  )
}

interface PageNotFoundProps {
  slug: string
}

export function PageNotFound({ slug }: PageNotFoundProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileQuestion className="text-muted-foreground mb-4 h-16 w-16" />
      <h1 className="mb-2 text-2xl font-bold">Page not found</h1>
      <p className="text-muted-foreground mb-6">
        The page "{slug}" does not exist yet.
      </p>
      <Button asChild>
        <a href={`new?slug=${encodeURIComponent(slug)}`}>
          <Edit className="mr-2 h-4 w-4" />
          Create this page
        </a>
      </Button>
    </div>
  )
}

export function PageViewSkeleton() {
  return (
    <article className="space-y-6">
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <Skeleton className="h-9 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-24" />
        </div>
      </header>
      <Separator />
      <div className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </article>
  )
}
