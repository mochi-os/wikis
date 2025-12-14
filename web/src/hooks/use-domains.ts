import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  DomainsData,
  DomainDetails,
  UserSearchResult,
  App,
  Entity,
} from '@/types/domains'
import endpoints from '@/api/endpoints'
import { apiClient } from '@mochi/common'

export function useDomainsData() {
  return useQuery({
    queryKey: ['domains'],
    queryFn: async () => {
      const response = await apiClient.get<DomainsData>(endpoints.domains.data)
      return response.data
    },
  })
}

export function useCreateDomain() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (domain: string) => {
      const response = await apiClient.post(endpoints.domains.create, {
        domain,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] })
    },
  })
}

export function useDomainDetails(domain: string) {
  return useQuery({
    queryKey: ['domains', domain],
    queryFn: async () => {
      const response = await apiClient.get<DomainDetails>(
        endpoints.domains.get,
        {
          params: { domain },
        }
      )
      return response.data
    },
    enabled: !!domain,
  })
}

export function useUpdateDomain() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      domain: string
      verified?: boolean
      tls?: boolean
    }) => {
      const response = await apiClient.post(endpoints.domains.update, data)
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['domains'] })
      queryClient.invalidateQueries({ queryKey: ['domains', variables.domain] })
    },
  })
}

export function useDeleteDomain() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (domain: string) => {
      const response = await apiClient.post(endpoints.domains.delete, {
        domain,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domains'] })
    },
  })
}

export function useCreateRoute() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      domain: string
      path: string
      method: string
      target: string
      priority?: number
      context?: string
    }) => {
      const response = await apiClient.post(endpoints.domains.routeCreate, data)
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['domains', variables.domain] })
    },
  })
}

export function useUpdateRoute() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      domain: string
      path: string
      method?: string
      target?: string
      priority?: number
      enabled?: boolean
    }) => {
      const response = await apiClient.post(endpoints.domains.routeUpdate, data)
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['domains', variables.domain] })
    },
  })
}

export function useDeleteRoute() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { domain: string; path: string }) => {
      const response = await apiClient.post(endpoints.domains.routeDelete, data)
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['domains', variables.domain] })
    },
  })
}

export function useCreateDelegation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      domain: string
      path: string
      owner: number
    }) => {
      const response = await apiClient.post(
        endpoints.domains.delegationCreate,
        data
      )
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['domains', variables.domain] })
    },
  })
}

export function useDeleteDelegation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      domain: string
      path: string
      owner: number
    }) => {
      const response = await apiClient.post(
        endpoints.domains.delegationDelete,
        data
      )
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['domains', variables.domain] })
    },
  })
}

export function useUserSearch(query: string) {
  return useQuery({
    queryKey: ['users', 'search', query],
    queryFn: async () => {
      const response = await apiClient.get<{ users: UserSearchResult[] }>(
        endpoints.domains.userSearch,
        { params: { query } }
      )
      return response.data.users
    },
    enabled: query.length >= 2,
  })
}

export function useApps() {
  return useQuery({
    queryKey: ['apps'],
    queryFn: async () => {
      const response = await apiClient.get<{ apps: App[] }>(
        endpoints.domains.apps
      )
      return response.data.apps
    },
  })
}

export function useEntities() {
  return useQuery({
    queryKey: ['entities'],
    queryFn: async () => {
      const response = await apiClient.get<{ entities: Entity[] }>(
        endpoints.domains.entities
      )
      return response.data.entities
    },
  })
}
