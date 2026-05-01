import { Button, DataChip, cn } from '@mochi/web'
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
      <Button variant='ghost' size='icon' className='size-8 shrink-0' asChild aria-label={t`Open link in new tab`} title={t`Open link in new tab`}>
        <a href={targetHref} target='_blank' rel='noopener noreferrer'>
          <ExternalLink className='h-3.5 w-3.5' />
          <span className='sr-only'><Trans>Open link</Trans></span>
        </a>
      </Button>
    </div>
  )
}
