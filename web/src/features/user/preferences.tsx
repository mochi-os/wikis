import { useState, useMemo } from 'react'
import { Check, ChevronsUpDown, Loader2, RotateCcw } from 'lucide-react'
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  GeneralError,
  Header,
  Label,
  ListSkeleton,
  Main,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
  getErrorMessage,
  toast,
  usePageTitle,
  useTheme,
} from '@mochi/web'
import {
  usePreferencesData,
  useSetPreference,
  useResetPreferences,
} from '@/hooks/use-preferences'

const themeLabels: Record<string, string> = {
  light: 'Light',
  dark: 'Dark',
  auto: 'System',
}

function getTimezones(): string[] {
  try {
    // TypeScript doesn't have types for supportedValuesOf yet
    return (
      (
        Intl as { supportedValuesOf?: (key: string) => string[] }
      ).supportedValuesOf?.('timeZone') ?? []
    )
  } catch {
    return []
  }
}

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

function TimezoneSelect({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const timezones = useMemo(() => getTimezones(), [])
  const browserTimezone = useMemo(() => getBrowserTimezone(), [])

  const formatTimezone = (tz: string) => tz.replace(/_/g, ' ')
  const displayValue =
    value === 'auto'
      ? `Auto (${formatTimezone(browserTimezone)})`
      : formatTimezone(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className='w-full justify-between'
          disabled={disabled}
        >
          <span className='truncate'>{displayValue}</span>
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[350px] p-0'>
        <Command>
          <CommandInput placeholder='Search timezone...' />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value='auto'
                onSelect={() => {
                  onChange('auto')
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4 shrink-0',
                    value === 'auto' ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <span className='truncate'>
                  Auto ({formatTimezone(browserTimezone)})
                </span>
              </CommandItem>
              {timezones.map((tz) => (
                <CommandItem
                  key={tz}
                  value={tz}
                  onSelect={() => {
                    onChange(tz)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value === tz ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className='truncate'>{formatTimezone(tz)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function PreferenceRow({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between'>
      <div className='space-y-0.5'>
        <Label className='text-base'>{label}</Label>
        <p className='text-muted-foreground text-sm'>{description}</p>
      </div>
      <div className='w-full sm:w-48'>{children}</div>
    </div>
  )
}

export function UserPreferences() {
  usePageTitle('Preferences')
  const { data, isLoading, error, refetch } = usePreferencesData()
  const setPreference = useSetPreference()
  const resetPreferences = useResetPreferences()
  const { setTheme } = useTheme()

  const handleChange = (key: string, value: string) => {
    if (key === 'theme') {
      const themeValue =
        value === 'auto' ? 'system' : (value as 'light' | 'dark')
      setTheme(themeValue)
    }
    setPreference.mutate(
      { [key]: value },
      {
        onSuccess: () => {
          toast.success('Preference updated')
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, 'Failed to update preference'))
        },
      }
    )
  }

  const handleReset = () => {
    resetPreferences.mutate(undefined, {
      onSuccess: () => {
        toast.success('Preferences reset to defaults')
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, 'Failed to reset preferences'))
      },
    })
  }

  return (
    <>
      <Header className="border-b-0">
        <h1 className='text-lg font-semibold'>Preferences</h1>
      </Header>

      <Main>
        {error ? (
          <GeneralError error={error} minimal mode='inline' reset={refetch} />
        ) : isLoading ? (
          <ListSkeleton variant='simple' height='h-16' count={3} />
        ) : data ? (
          <>
            <div className='divide-y'>
              <PreferenceRow label='Theme' description='Appearance'>
                <Select
                  value={data.preferences.theme}
                  onValueChange={(value) => handleChange('theme', value)}
                  disabled={setPreference.isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(themeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PreferenceRow>

              <PreferenceRow
                label='Timezone'
                description='Timezone for displaying dates and times'
              >
                <TimezoneSelect
                  value={data.preferences.timezone}
                  onChange={(value) => handleChange('timezone', value)}
                  disabled={setPreference.isPending}
                />
              </PreferenceRow>
            </div>

            <div className='mt-6 flex justify-end'>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant='outline'
                    disabled={isLoading || resetPreferences.isPending}
                  >
                    {resetPreferences.isPending ? (
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    ) : (
                      <RotateCcw className='mr-2 h-4 w-4' />
                    )}
                    Reset to Defaults
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset preferences?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will reset all preferences to their default values.
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
            </div>
          </>
        ) : null}
      </Main>
    </>
  )
}
