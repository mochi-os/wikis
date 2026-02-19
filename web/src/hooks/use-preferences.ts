import {
  usePreferencesData as usePreferencesDataCommon,
  useSetPreference as useSetPreferenceCommon,
  useResetPreferences as useResetPreferencesCommon,
} from '@mochi/common'
import endpoints from '@/api/endpoints'

export function usePreferencesData() {
  return usePreferencesDataCommon(endpoints.user.preferences)
}

export function useSetPreference() {
  return useSetPreferenceCommon(endpoints.user.preferencesSet)
}

export function useResetPreferences() {
  return useResetPreferencesCommon(endpoints.user.preferencesReset)
}
