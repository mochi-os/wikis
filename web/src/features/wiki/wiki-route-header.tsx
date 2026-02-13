import type { ReactNode } from 'react'
import { PageHeader, type HeaderBackConfig } from '@mochi/common'

interface WikiRouteHeaderProps {
  title: ReactNode
  actions?: ReactNode
  back?: HeaderBackConfig
  icon?: ReactNode
  description?: string
}

export function WikiRouteHeader({
  title,
  actions,
  back,
  icon,
  description,
}: WikiRouteHeaderProps) {
  return (
    <PageHeader
      title={title}
      actions={actions}
      back={back}
      icon={icon}
      description={description}
    />
  )
}
