// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

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
