import { PageHeader as CommonPageHeader, type HeaderBackConfig } from '@mochi/web'
import type { WikiPage } from '@/types/wiki'

interface PageHeaderProps {
  page: WikiPage
  actions?: React.ReactNode
  menuAction?: React.ReactNode
  primaryAction?: React.ReactNode
  back?: HeaderBackConfig
  showSidebarTrigger?: boolean
}

export function PageHeader({
  page,
  actions,
  menuAction,
  primaryAction,
  back,
  showSidebarTrigger,
}: PageHeaderProps) {
  return (
    <CommonPageHeader
      title={page.title}
      actions={actions}
      menuAction={menuAction}
      primaryAction={primaryAction}
      back={back}
      showSidebarTrigger={showSidebarTrigger}
    />
  )
}
