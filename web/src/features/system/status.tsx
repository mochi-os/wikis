import { format } from 'date-fns'
import { Activity } from 'lucide-react'
import { useSystemSettingsData } from '@/hooks/use-system-settings'
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'

function formatTimestamp(value: string): string {
  const timestamp = parseInt(value, 10)
  if (isNaN(timestamp)) return value
  return format(new Date(timestamp * 1000), 'yyyy-MM-dd HH:mm:ss')
}

export function SystemStatus() {
  const { data, isLoading, error } = useSystemSettingsData()

  if (error) {
    return (
      <>
        <Header>
          <h1 className='text-lg font-semibold'>Status</h1>
        </Header>
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
      <Header>
        <h1 className='text-lg font-semibold'>Status</h1>
      </Header>

      <Main>
        <div className='mb-6 flex items-center gap-2'>
          <Activity className='h-5 w-5' />
          <h2 className='text-lg font-semibold'>Server</h2>
        </div>
        {isLoading ? (
          <div className='space-y-3'>
            <Skeleton className='h-4 w-48' />
            <Skeleton className='h-4 w-64' />
          </div>
        ) : (
          <dl className='grid gap-3 text-sm'>
            <div className='flex flex-col gap-1 sm:flex-row sm:gap-4'>
              <dt className='text-muted-foreground w-28 shrink-0'>Version</dt>
              <dd className='font-medium'>{serverVersion}</dd>
            </div>
            <div className='flex flex-col gap-1 sm:flex-row sm:gap-4'>
              <dt className='text-muted-foreground w-28 shrink-0'>Started</dt>
              <dd className='font-mono text-xs'>
                {formatTimestamp(serverStarted)}
              </dd>
            </div>
          </dl>
        )}
      </Main>
    </>
  )
}
