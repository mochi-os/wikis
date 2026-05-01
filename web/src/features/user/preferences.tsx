import { Loader2, RotateCcw, Sliders } from 'lucide-react'
import { Trans, useLingui } from '@lingui/react/macro'
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
  useAppearanceLabels,
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
  const { t } = useLingui()
  const appearanceLabels = useAppearanceLabels()
  usePageTitle(t`Preferences`)
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
          toast.success(t`Preference updated`)
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, t`Failed to update preference`))
        },
      }
    )
  }

  const handleReset = () => {
    resetPreferences.mutate(undefined, {
      onSuccess: () => {
        toast.success(t`Preferences reset to defaults`)
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, t`Failed to reset preferences`))
      },
    })
  }

  return (
    <>
      <PageHeader title={t`Preferences`} icon={<Sliders className='size-4 md:size-5' />} />

      <Main className="space-y-8">
        <Section
          title={t`General`}
          description={t`Manage your display settings and preferences`}
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
                    <Loader2 className='me-2 h-3.5 w-3.5 animate-spin' />
                  ) : (
                    <RotateCcw className='me-2 h-3.5 w-3.5' />
                  )}
                  Reset to Defaults
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle><Trans>Reset preferences?</Trans></AlertDialogTitle>
                  <AlertDialogDescription>
                    <Trans>This will reset all preferences to their default values.</Trans>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel><Trans>Cancel</Trans></AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset}>
                    <Trans>Reset</Trans>
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
                <FieldRow label={t`Appearance`} description={t`Light or dark mode`}>
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
                  label={t`Time zone`}
                  description={t`Used for displaying dates and times`}
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
