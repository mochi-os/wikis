import { format } from 'date-fns'
import { Link } from '@tanstack/react-router'
import { Edit, History, MoreHorizontal, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { WikiPage } from '@/types/wiki'
import { usePermissions } from '@/context/wiki-context'

interface PageHeaderProps {
  page: WikiPage
}

export function PageHeader({ page }: PageHeaderProps) {
  const permissions = usePermissions()

  return (
    <div className="flex flex-1 items-center justify-between gap-4">
      <h1 className="truncate text-3xl font-semibold leading-normal">{page.title}</h1>
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="History">
            <Link to="/$page/history" params={{ page: page.slug }}>
              <History className="h-4 w-4" />
            </Link>
          </Button>
          {permissions.edit && (
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Edit">
              <Link to="/$page/edit" params={{ page: page.slug }}>
                <Edit className="h-4 w-4" />
              </Link>
            </Button>
          )}
          {permissions.delete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="More">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/$page/delete" params={{ page: page.slug }}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete page
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <span className="text-muted-foreground text-xs">
          #{page.version}, {format(new Date(page.updated * 1000), 'yyyy-MM-dd HH:mm:ss')}
        </span>
      </div>
    </div>
  )
}
