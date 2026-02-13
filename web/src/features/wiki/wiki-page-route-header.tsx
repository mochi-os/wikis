import type { HeaderBackConfig } from '@mochi/common'
import type { WikiPage } from '@/types/wiki'
import { PageHeader } from '@/features/wiki/page-header'

interface WikiPageRouteHeaderProps {
  page: WikiPage
  actions?: React.ReactNode
  back?: HeaderBackConfig
}

export function WikiPageRouteHeader({
  page,
  actions,
  back,
}: WikiPageRouteHeaderProps) {
  return <PageHeader page={page} actions={actions} back={back} />
}
