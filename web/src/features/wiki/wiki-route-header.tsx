import type { ReactNode } from 'react'
import { PageHeader, type HeaderBackConfig } from '@mochi/web'

interface WikiRouteHeaderProps {
  title: ReactNode
  actions?: ReactNode
  menuAction?: ReactNode
  back?: HeaderBackConfig
  icon?: ReactNode
  description?: string
}

export function WikiRouteHeader({
  title,
  actions,
  menuAction,
  back,
  icon,
  description,
}: WikiRouteHeaderProps) {
  return (
    <PageHeader
      title={title}
      actions={actions}
      menuAction={menuAction}
      back={back}
      icon={icon}
      description={description}
    />
  )
}
