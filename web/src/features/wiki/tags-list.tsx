import { Tags, Tag as TagIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import type { Tag } from '@/types/wiki'

interface TagsListProps {
  tags: Tag[]
}

export function TagsList({ tags }: TagsListProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Tags className="h-6 w-6" />
        <h1 className="text-2xl font-bold">All Tags</h1>
      </div>

      <p className="text-muted-foreground">
        Browse pages by tag. Click a tag to see all pages with that tag.
      </p>

      <Separator />

      {/* Tags grid */}
      {tags.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          No tags found. Add tags to pages to organize your wiki.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {tags.map((tag) => (
            <a
              key={tag.tag}
              href={`tag/${tag.tag}`}
              className="group"
            >
              <Badge
                variant="secondary"
                className="cursor-pointer px-3 py-1.5 text-sm transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
              >
                <TagIcon className="mr-1.5 h-3.5 w-3.5" />
                {tag.tag}
                <span className="bg-background/20 ml-2 rounded-full px-1.5 py-0.5 text-xs">
                  {tag.count}
                </span>
              </Badge>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export function TagsListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-6" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-5 w-96" />
      <Separator />
      <div className="flex flex-wrap gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
    </div>
  )
}
