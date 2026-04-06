import { PageHeader as CommonPageHeader, type HeaderBackConfig } from '@mochi/web'
import type { WikiPage } from '@/types/wiki'

interface PageHeaderProps {
  page: WikiPage
  actions?: React.ReactNode
  menuAction?: React.ReactNode
  back?: HeaderBackConfig
}

export function PageHeader({ page, actions, menuAction, back }: PageHeaderProps) {
  return (
    <CommonPageHeader
      title={page.title}
      actions={actions}
      menuAction={menuAction}
      back={back}
    />
  )
}
