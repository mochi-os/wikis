import type { WikiPage } from '@/types/wiki'

interface PageHeaderProps {
  page: WikiPage
  actions?: React.ReactNode
}

export function PageHeader({ page, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-1 items-center justify-between gap-4">
      <h1 className="truncate text-2xl font-semibold">{page.title}</h1>
      {actions}
    </div>
  )
}
