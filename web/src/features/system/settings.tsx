import { useState } from 'react'
import type { SystemSetting } from '@/types/settings'
import { Loader2, Lock, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { usePreferencesData } from '@/hooks/use-preferences'
import {
  useSystemSettingsData,
  useSetSystemSetting,
} from '@/hooks/use-system-settings'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'

function formatSettingName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatSettingValue(
  name: string,
  value: string,
  timezone?: string
): string {
  if (name === 'server_started' && value) {
    const timestamp = parseInt(value, 10)
    if (!isNaN(timestamp)) {
      const date = new Date(timestamp * 1000)
      const tz = timezone === 'auto' || !timezone ? undefined : timezone
      return date.toLocaleString('sv-SE', { timeZone: tz }).replace('T', ' ')
    }
  }
  return value || '(empty)'
}

function isBooleanSetting(setting: SystemSetting): boolean {
  return setting.pattern === '^(true|false)$'
}

function SettingRow({
  setting,
  onSave,
  isSaving,
  timezone,
}: {
  setting: SystemSetting
  onSave: (name: string, value: string) => void
  isSaving: boolean
  timezone?: string
}) {
  const [localValue, setLocalValue] = useState(setting.value)
  const isBoolean = isBooleanSetting(setting)
  const hasChanged = localValue !== setting.value
  const isDefault = setting.value === setting.default

  const handleSave = () => {
    onSave(setting.name, localValue)
  }

  const handleReset = () => {
    onSave(setting.name, setting.default)
    setLocalValue(setting.default)
  }

  const handleToggle = (checked: boolean) => {
    const newValue = checked ? 'true' : 'false'
    setLocalValue(newValue)
    onSave(setting.name, newValue)
  }

  return (
    <div className='flex flex-col gap-4 py-4 sm:flex-row sm:items-start sm:justify-between'>
      <div className='flex-1 space-y-1'>
        <div className='flex items-center gap-2'>
          <Label className='text-base'>{formatSettingName(setting.name)}</Label>
          {setting.read_only && (
            <Lock className='text-muted-foreground h-3.5 w-3.5' />
          )}
        </div>
        <p className='text-muted-foreground text-sm'>{setting.description}</p>
        {!isDefault && !setting.read_only && (
          <p className='text-muted-foreground text-xs'>
            Default: {setting.default || '(empty)'}
          </p>
        )}
      </div>
      <div className='flex items-center gap-2'>
        {setting.read_only ? (
          <div className='text-muted-foreground font-mono text-sm'>
            {formatSettingValue(setting.name, setting.value, timezone)}
          </div>
        ) : isBoolean ? (
          <>
            <Switch
              checked={localValue === 'true'}
              onCheckedChange={handleToggle}
              disabled={isSaving}
            />
            {!isDefault && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8'
                    disabled={isSaving}
                  >
                    <RotateCcw className='h-4 w-4' />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset to default?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will reset "{formatSettingName(setting.name)}" to its
                      default value ({setting.default}).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReset}>
                      Reset
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        ) : (
          <>
            <Input
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              className='w-64 font-mono text-sm'
              disabled={isSaving}
            />
            {hasChanged && (
              <Button size='sm' onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  'Save'
                )}
              </Button>
            )}
            {!hasChanged && !isDefault && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8'
                    disabled={isSaving}
                  >
                    <RotateCcw className='h-4 w-4' />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset to default?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will reset "{formatSettingName(setting.name)}" to its
                      default value ({setting.default || '(empty)'}).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReset}>
                      Reset
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function SystemSettings() {
  const { data, isLoading, error } = useSystemSettingsData()
  const { data: prefsData } = usePreferencesData()
  const setSetting = useSetSystemSetting()
  const [savingName, setSavingName] = useState<string | null>(null)
  const timezone = prefsData?.preferences.timezone

  const handleSave = (name: string, value: string) => {
    setSavingName(name)
    setSetting.mutate(
      { name, value },
      {
        onSuccess: () => {
          toast.success('Setting updated')
          setSavingName(null)
        },
        onError: () => {
          toast.error('Failed to update setting')
          setSavingName(null)
        },
      }
    )
  }

  if (error) {
    return (
      <>
        <Header>
          <h1 className='text-lg font-semibold'>System Settings</h1>
        </Header>
        <Main>
          <p className='text-muted-foreground'>Failed to load settings</p>
        </Main>
      </>
    )
  }

  const statusSettings = ['server_version', 'server_started']
  const sortedSettings = data?.settings
    ? [...data.settings]
        .filter((s) => !statusSettings.includes(s.name))
        .sort((a, b) => a.name.localeCompare(b.name))
    : []

  return (
    <>
      <Header>
        <h1 className='text-lg font-semibold'>System Settings</h1>
      </Header>

      <Main>
        {isLoading ? (
          <div className='space-y-6'>
            <Skeleton className='h-16 w-full' />
            <Skeleton className='h-16 w-full' />
            <Skeleton className='h-16 w-full' />
            <Skeleton className='h-16 w-full' />
          </div>
        ) : (
          <div className='divide-y'>
            {sortedSettings.map((setting) => (
              <SettingRow
                key={setting.name}
                setting={setting}
                onSave={handleSave}
                isSaving={savingName === setting.name}
                timezone={timezone}
              />
            ))}
          </div>
        )}
      </Main>
    </>
  )
}
