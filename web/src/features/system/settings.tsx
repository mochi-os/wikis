import { useState } from 'react'
import type { SystemSetting } from '@/types/settings'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, Lock, RotateCcw, Settings } from 'lucide-react'
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
  Button,
  DataChip,
  FieldRow,
  Input,
  Main,
  PageHeader,
  Section,
  Skeleton,
  Switch,
  getErrorMessage,
  toast,
  usePageTitle,
} from '@mochi/common'
import { usePreferencesData } from '@/hooks/use-preferences'
import {
  useSystemSettingsData,
  useSetSystemSetting,
} from '@/hooks/use-system-settings'

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
    <FieldRow
      label={formatSettingName(setting.name)}
      description={setting.description}
    >
      {setting.read_only ? (
        <DataChip
          value={formatSettingValue(setting.name, setting.value, timezone)}
          icon={<Lock className='size-3' />}
          copyable={false}
        />
      ) : isBoolean ? (
        <div className='flex items-center gap-2'>
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
        </div>
      ) : (
        <div className='flex w-full max-w-sm items-center gap-2'>
          <Input
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            className='h-9 font-mono text-sm'
            disabled={isSaving}
          />
          {hasChanged ? (
            <Button size='sm' onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                'Save'
              )}
            </Button>
          ) : !isDefault && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-9 w-9'
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
        </div>
      )}
    </FieldRow>
  )
}

export function SystemSettings() {
  usePageTitle('System settings')
  const navigate = useNavigate()
  const { data, isLoading, error } = useSystemSettingsData()
  const { data: prefsData } = usePreferencesData()
  const setSetting = useSetSystemSetting()
  const [savingName, setSavingName] = useState<string | null>(null)
  const timezone = prefsData?.preferences.timezone
  const goBackToWikis = () => navigate({ to: '/' })

  const handleSave = (name: string, value: string) => {
    setSavingName(name)
    setSetting.mutate(
      { name, value },
      {
        onSuccess: () => {
          toast.success('Setting updated')
          setSavingName(null)
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, 'Failed to update setting'))
          setSavingName(null)
        },
      }
    )
  }

  if (error) {
    return (
      <>
        <PageHeader
          title='System settings'
          icon={<Settings className='size-4 md:size-5' />}
          back={{ label: 'Back to wikis', onFallback: goBackToWikis }}
        />
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
      <PageHeader
        title='System settings'
        icon={<Settings className='size-4 md:size-5' />}
        back={{ label: 'Back to wikis', onFallback: goBackToWikis }}
      />

      <Main>
        <Section title='Configuration' description='Global server settings'>
          <div className='divide-y-0'>
            {isLoading ? (
              <div className='space-y-6 py-4'>
                <Skeleton className='h-12 w-full' />
                <Skeleton className='h-12 w-full' />
                <Skeleton className='h-12 w-full' />
                <Skeleton className='h-12 w-full' />
              </div>
            ) : (
              sortedSettings.map((setting) => (
                <SettingRow
                  key={setting.name}
                  setting={setting}
                  onSave={handleSave}
                  isSaving={savingName === setting.name}
                  timezone={timezone}
                />
              ))
            )}
          </div>
        </Section>
      </Main>
    </>
  )
}
