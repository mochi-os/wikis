import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UsersData, User, SessionsData } from '@/types/users'
import endpoints from '@/api/endpoints'
import { apiClient } from '@/lib/apiClient'

export function useSystemUsersData(limit = 25, offset = 0, search = '') {
  return useQuery({
    queryKey: ['system', 'users', limit, offset, search],
    queryFn: async () => {
      const response = await apiClient.get<UsersData>(
        endpoints.system.usersList,
        {
          params: { limit, offset, search: search || undefined },
        }
      )
      return response.data
    },
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { username: string; role: string }) => {
      const response = await apiClient.post<User>(
        endpoints.system.usersCreate,
        data
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'users'] })
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      id: number
      username?: string
      role?: string
    }) => {
      const response = await apiClient.post(endpoints.system.usersUpdate, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'users'] })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.post(endpoints.system.usersDelete, {
        id,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'users'] })
    },
  })
}

export function useSuspendUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.post(endpoints.system.usersSuspend, {
        id,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'users'] })
    },
  })
}

export function useActivateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.post(endpoints.system.usersActivate, {
        id,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'users'] })
    },
  })
}

export function useUserSessions(userId: number) {
  return useQuery({
    queryKey: ['system', 'users', userId, 'sessions'],
    queryFn: async () => {
      const response = await apiClient.get<SessionsData>(
        endpoints.system.usersSessions,
        {
          params: { id: userId },
        }
      )
      return response.data
    },
  })
}

export function useRevokeUserSessions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { id: number; code?: string }) => {
      const response = await apiClient.post<{ ok: boolean; revoked: number }>(
        endpoints.system.usersSessionsRevoke,
        data
      )
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['system', 'users', variables.id, 'sessions'],
      })
    },
  })
}
