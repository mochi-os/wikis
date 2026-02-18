import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useQueryWithError } from '@mochi/common'
import type { User } from '@/types/users'
import endpoints from '@/api/endpoints'
import { apiClient } from '@mochi/common'
import {
  type SystemUsersResponse,
  systemUsersApi,
} from '@/api/system-users'
import type { SessionsData } from '@/types/users'

export const systemUserKeys = {
  all: () => ['system-users'] as const,
  list: (limit: number, offset: number, search: string) =>
    [...systemUserKeys.all(), 'list', limit, offset, search] as const,
  sessions: (userId: string) =>
    [...systemUserKeys.all(), 'sessions', userId] as const,
}

export function useSystemUsersData(
  limit: number,
  offset: number,
  search: string
) {
  return useQueryWithError<SystemUsersResponse, Error>({
    queryKey: systemUserKeys.list(limit, offset, search),
    queryFn: () => systemUsersApi.list(limit, offset, search),
  })
}

export const useCreateUser = () => {
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
  return useQueryWithError<SessionsData, Error>({
    queryKey: systemUserKeys.sessions(String(userId)),
    queryFn: () => systemUsersApi.getSessions(userId),
    enabled: !!userId,
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
