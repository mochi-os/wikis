// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { DataChip, cn } from '@mochi/web'

interface ValueLinkChipProps {
  value: string
  className?: string
}

// Shows one identifier-ish value: a redirect's source or target slug, or the
// entity id of the wiki this one replicates. Never rendered as a link - these
// are slugs and ids, not URLs.
export function ValueLinkChip({ value, className }: ValueLinkChipProps) {
  return (
    <div className={cn('flex min-w-0 items-center', className)}>
      <DataChip value={value} className='min-w-0 flex-1' truncate='middle' />
    </div>
  )
}
