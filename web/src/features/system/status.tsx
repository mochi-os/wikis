import { format } from 'date-fns'
import { Activity } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import {
  DataChip,
  FieldRow,
  Main,
  PageHeader,
  Section,
  Skeleton,
  usePageTitle,
} from '@mochi/common'
import { useSystemSettingsData } from '@/hooks/use-system-settings'

function formatTimestamp(value: string): string {
  const timestamp = parseInt(value, 10)
  if (isNaN(timestamp)) return value
  return format(new Date(timestamp * 1000), 'yyyy-MM-dd HH:mm:ss')
}

export function SystemStatus() {
  usePageTitle('Status')
  const navigate = useNavigate()
  const { data, isLoading, error } = useSystemSettingsData()
  const goBackToWikis = () => navigate({ to: '/' })

  if (error) {
    return (
      <>
        <PageHeader
          title='Status'
          icon={<Activity className='size-4 md:size-5' />}
          back={{ label: 'Back to wikis', onFallback: goBackToWikis }}
        />
        <Main>
          <p className='text-muted-foreground'>Failed to load status</p>
        </Main>
      </>
    )
  }

  const settings = data?.settings ?? []
  const serverVersion =
    settings.find((s) => s.name === 'server_version')?.value ?? ''
  const serverStarted =
    settings.find((s) => s.name === 'server_started')?.value ?? ''

  return (
    <>
      <PageHeader
        title='Status'
        icon={<Activity className='size-4 md:size-5' />}
        back={{ label: 'Back to wikis', onFallback: goBackToWikis }}
      />

      <Main>
        <Section title='Server' description='Current server status and runtime metadata'>
          {isLoading ? (
            <div className='space-y-4 py-2'>
              <Skeleton className='h-12 w-full' />
              <Skeleton className='h-12 w-full' />
            </div>
          ) : (
            <div className='divide-y-0'>
              <FieldRow label='Version'>
                <DataChip value={serverVersion || '(unknown)'} copyable={false} />
              </FieldRow>
              <FieldRow label='Started'>
                <DataChip value={formatTimestamp(serverStarted)} copyable={false} />
              </FieldRow>
            </div>
          )}
        </Section>
      </Main>
    </>
  )
}
