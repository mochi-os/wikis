import { PageHeader as CommonPageHeader, type HeaderBackConfig } from '@mochi/common'
import type { WikiPage } from '@/types/wiki'

interface PageHeaderProps {
  page: WikiPage
  actions?: React.ReactNode
  back?: HeaderBackConfig
}

export function PageHeader({ page, actions, back }: PageHeaderProps) {
  return (
    <CommonPageHeader title={page.title} actions={actions} back={back} />
  )
}
