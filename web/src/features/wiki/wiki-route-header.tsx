// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

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
