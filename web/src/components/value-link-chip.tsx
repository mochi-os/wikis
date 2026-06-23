// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { Button, DataChip, cn, Tooltip, TooltipTrigger, TooltipContent } from '@mochi/web'
import { Trans } from '@lingui/react/macro'
import { ExternalLink } from 'lucide-react'
import { t } from '@lingui/core/macro'

interface ValueLinkChipProps {
  value: string
  href?: string
  className?: string
  chipClassName?: string
}

export function ValueLinkChip({
  value,
  href,
  className,
  chipClassName,
}: ValueLinkChipProps) {
  const targetHref = href ?? value

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <DataChip
        value={value}
        className='min-w-0 flex-1'
        chipClassName={chipClassName}
        truncate='middle'
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant='ghost' size='icon' className='size-8 shrink-0' asChild aria-label={t`Open link in new tab`}>
            <a href={targetHref} target='_blank' rel='noopener noreferrer'>
              <ExternalLink className='h-3.5 w-3.5' />
              <span className='sr-only'><Trans>Open link</Trans></span>
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t`Open link in new tab`}</TooltipContent>
      </Tooltip>
    </div>
  )
}
