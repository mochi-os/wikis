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
// entity id of the wiki this one replicates.
//
// It used to carry an "open in new tab" button whose href fell back to the
// value itself. Every call site passes a page slug or an entity id, never a
// URL, so that link resolved relative to the current page and always went
// nowhere. It was also the one place a redirect source reached an href, which
// is what made an unvalidated source worth worrying about: React neutralises a
// javascript: URL there, and that is a property of React rather than of this
// code. Sources are validated at every write path now (slug_problem in
// wikis.star), and the button is gone, so neither the broken link nor the sink
// is left.
export function ValueLinkChip({ value, className }: ValueLinkChipProps) {
  return (
    <div className={cn('flex min-w-0 items-center', className)}>
      <DataChip value={value} className='min-w-0 flex-1' truncate='middle' />
    </div>
  )
}
