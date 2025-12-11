import { format } from 'date-fns'
import { Tag as TagIcon, FileText, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import type { TagPage } from '@/types/wiki'

interface TagPagesProps {
  tag: string
  pages: TagPage[]
}

export function TagPages({ tag, pages }: TagPagesProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <TagIcon className="h-6 w-6" />
          <h1 className="text-2xl font-bold">
            Pages tagged{' '}
            <Badge variant="secondary" className="ml-1 text-lg">
              {tag}
            </Badge>
          </h1>
        </div>
        <Button variant="outline" asChild>
          <a href="tags">
            <ArrowLeft className="mr-2 h-4 w-4" />
            All tags
          </a>
        </Button>
      </div>

      <p className="text-muted-foreground">
        {pages.length} page{pages.length !== 1 ? 's' : ''} with this tag.
      </p>

      <Separator />

      {/* Pages list */}
      {pages.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          No pages found with this tag.
        </p>
      ) : (
        <div className="space-y-2">
          {pages.map((page) => (
            <a
              key={page.page}
              href={page.page}
              className="hover:bg-muted/50 group flex items-center gap-4 rounded-lg border p-4 transition-colors"
            >
              <FileText className="text-muted-foreground h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold group-hover:underline">
                  {page.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  Updated {format(new Date(page.updated * 1000), 'PPP')}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export function TagPagesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <Skeleton className="h-5 w-32" />
      <Separator />
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
            <Skeleton className="h-5 w-5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
