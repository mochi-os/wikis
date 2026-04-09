import type { ReactNode } from 'react'
import { PageHeader, type HeaderBackConfig } from '@mochi/web'

interface WikiRouteHeaderProps {
  title: ReactNode
  actions?: ReactNode
  menuAction?: ReactNode
  primaryAction?: ReactNode
  back?: HeaderBackConfig
  icon?: ReactNode
  description?: string
  showSidebarTrigger?: boolean
}

export function WikiRouteHeader({
  title,
  actions,
  menuAction,
  primaryAction,
  back,
  icon,
  description,
  showSidebarTrigger,
}: WikiRouteHeaderProps) {
  return (
    <PageHeader
      title={title}
      actions={actions}
      menuAction={menuAction}
      primaryAction={primaryAction}
      back={back}
      icon={icon}
      description={description}
      showSidebarTrigger={showSidebarTrigger}
    />
  )
}
