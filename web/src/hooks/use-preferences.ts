import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PreferencesData } from '@/types/preferences'
import endpoints from '@/api/endpoints'
import { apiClient } from '@/lib/apiClient'

export function usePreferencesData() {
  return useQuery({
    queryKey: ['user', 'preferences'],
    queryFn: async () => {
      const response = await apiClient.get<PreferencesData>(
        endpoints.user.preferences
      )
      return response.data
    },
  })
}

export function useSetPreference() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const response = await apiClient.post(endpoints.user.preferencesSet, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'preferences'] })
    },
  })
}

export function useResetPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(endpoints.user.preferencesReset)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'preferences'] })
    },
  })
}
