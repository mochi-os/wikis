import { Loader2, RotateCcw, Sliders } from 'lucide-react'
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
  FieldRow,
  GeneralError,
  ListSkeleton,
  Main,
  PageHeader,
  Section,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TimezoneSelect,
  getErrorMessage,
  appearanceLabels,
  toast,
  usePageTitle,
  useTheme,
} from '@mochi/web'
import {
  usePreferencesData,
  useSetPreference,
  useResetPreferences,
} from '@/hooks/use-preferences'

export function UserPreferences() {
  usePageTitle('Preferences')
  const { data, isLoading, error, refetch } = usePreferencesData()
  const setPreference = useSetPreference()
  const resetPreferences = useResetPreferences()
  const { setTheme } = useTheme()

  const handleChange = (key: 'appearance' | 'timezone', value: string) => {
    setPreference.mutate(
      { [key]: value },
      {
        onSuccess: () => {
          if (key === 'appearance') {
            setTheme(value === 'auto' ? 'system' : (value as 'light' | 'dark'))
          }
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
      <PageHeader title="Preferences" icon={<Sliders className='size-4 md:size-5' />} />

      <Main className="space-y-8">
        <Section
          title="General"
          description="Manage your display settings and preferences"
          action={
            !error && <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant='ghost'
                  size='sm'
                  disabled={isLoading || resetPreferences.isPending}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {resetPreferences.isPending ? (
                    <Loader2 className='mr-2 h-3.5 w-3.5 animate-spin' />
                  ) : (
                    <RotateCcw className='mr-2 h-3.5 w-3.5' />
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
          }
        >
          <div className='divide-y-0'>
            {error ? (
              <GeneralError error={error} minimal mode='inline' reset={refetch} />
            ) : isLoading ? (
              <ListSkeleton variant='simple' height='h-12' count={2} />
            ) : data ? (
              <>
                <FieldRow label='Appearance' description='Light or dark mode'>
                  <div className="w-full sm:w-64">
                    <Select
                      value={data.preferences.appearance}
                      onValueChange={(value) => handleChange('appearance', value)}
                      disabled={setPreference.isPending}
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(appearanceLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </FieldRow>

                <FieldRow
                  label='Time zone'
                  description='Used for displaying dates and times'
                >
                  <div className="w-full sm:w-64">
                    <TimezoneSelect
                      value={data.preferences.timezone}
                      onChange={(value) => handleChange('timezone', value)}
                      disabled={setPreference.isPending}
                    />
                  </div>
                </FieldRow>
              </>
            ) : null}
          </div>
        </Section>
      </Main>
    </>
  )
}
