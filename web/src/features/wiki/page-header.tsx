import { Link } from '@tanstack/react-router'
import { Edit, History, MoreHorizontal, Trash2 } from 'lucide-react'
import { Button } from '@mochi/common'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@mochi/common'
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="More">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {permissions.edit && (
            <DropdownMenuItem asChild>
              <Link to="/$page/edit" params={{ page: page.slug }}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link to="/$page/history" params={{ page: page.slug }}>
              <History className="mr-2 h-4 w-4" />
              History
            </Link>
          </DropdownMenuItem>
          {permissions.delete && (
            <DropdownMenuItem asChild>
              <Link to="/$page/delete" params={{ page: page.slug }}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
