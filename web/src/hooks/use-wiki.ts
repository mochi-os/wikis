import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  PageResponse,
  PageNotFoundResponse,
  PageEditResponse,
  NewPageResponse,
  PageHistoryResponse,
  PageRevisionResponse,
  PageRevertResponse,
  PageDeleteResponse,
  TagsResponse,
  TagPagesResponse,
  TagAddResponse,
  TagRemoveResponse,
  ChangesResponse,
  SearchResponse,
  SettingsResponse,
  SettingsSetResponse,
  RedirectsResponse,
  RedirectSetResponse,
  RedirectDeleteResponse,
  CommentsResponse,
  CommentCreateResponse,
  CommentEditResponse,
  CommentDeleteResponse,
  AttachmentsResponse,
  AttachmentUploadResponse,
  AttachmentDeleteResponse,
  AccessListResponse,
  WikiPermissions,
} from '@/types/wiki'
import endpoints from '@/api/endpoints'
import { requestHelpers } from '@mochi/web'
import { wikisRequest } from '@/api/request'
import { useWikiBaseURLOptional } from '@/context/wiki-base-url-context'

// Resolve an entity-scoped endpoint URL. When inside a WikiBaseURLProvider
// (entity context like /wikis/{fingerprint}/...), prefixes the endpoint with the
// entity base URL to form an absolute path. In class context (no provider), the
// endpoint is returned as-is and resolved by getApiBasepath().
function useEntityEndpoint() {
  const baseURL = useWikiBaseURLOptional()?.baseURL
  return (endpoint: string) => baseURL ? `${baseURL}${endpoint}` : endpoint
}

// Wiki info

export interface WikiInfoResponse {
  entity: boolean
  wiki?: { id: string; name: string; home: string; fingerprint?: string; source?: string }
  wikis?: Array<{ id: string; name: string; home: string; source?: string; fingerprint?: string }>
  permissions?: WikiPermissions
  fingerprint?: string
}

export function useWikiInfo() {
  return useQuery({
    queryKey: ['wiki', 'info'],
    // Use wikisRequest to always fetch from class level (app path)
    queryFn: () => wikisRequest.get<WikiInfoResponse>(endpoints.wiki.info),
  })
}

// Page queries

export function usePage(slug: string) {
  const e = useEntityEndpoint()
  return useQuery({
    queryKey: ['wiki', 'page', slug],
    queryFn: () =>
      requestHelpers.get<PageResponse | PageNotFoundResponse>(
        e(endpoints.wiki.page(slug))
      ),
    enabled: !!slug,
  })
}

export function usePageHistory(slug: string) {
  const e = useEntityEndpoint()
  return useQuery({
    queryKey: ['wiki', 'page', slug, 'history'],
    queryFn: () =>
      requestHelpers.get<PageHistoryResponse>(e(endpoints.wiki.pageHistory(slug))),
    enabled: !!slug,
  })
}

export function usePageRevision(slug: string, version: number) {
  const e = useEntityEndpoint()
  return useQuery({
    queryKey: ['wiki', 'page', slug, 'revision', version],
    queryFn: () =>
      requestHelpers.get<PageRevisionResponse>(
        e(endpoints.wiki.pageRevision(slug, version))
      ),
    enabled: !!slug && version > 0,
  })
}

// Page mutations

export function useEditPage() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: (data: {
      slug: string
      title: string
      content: string
      comment?: string
    }) =>
      requestHelpers.post<PageEditResponse>(
        e(endpoints.wiki.pageEdit(data.slug)),
        {
          title: data.title,
          content: data.content,
          comment: data.comment,
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['wiki', 'page', variables.slug],
      })
    },
  })
}

export function useCreatePage() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: (data: { slug: string; title: string; content?: string }) =>
      requestHelpers.post<NewPageResponse>(e(endpoints.wiki.newPage), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki'] })
    },
  })
}

export function useRevertPage() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: (data: { slug: string; version: number; comment?: string }) =>
      requestHelpers.post<PageRevertResponse>(
        e(endpoints.wiki.pageRevert(data.slug)),
        {
          version: data.version,
          comment: data.comment,
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['wiki', 'page', variables.slug],
      })
    },
  })
}

export function useDeletePage() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: (slug: string) =>
      requestHelpers.post<PageDeleteResponse>(e(endpoints.wiki.pageDelete(slug))),
    onSuccess: (_, slug) => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'page', slug] })
      queryClient.invalidateQueries({ queryKey: ['wiki', 'tags'] })
    },
  })
}

export interface PageRenameResponse {
  renamed: Array<{ old: string; new: string }>
  updated_links: number
}

export function useRenamePage() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: (data: {
      slug: string
      newSlug: string
      children?: boolean
      redirects?: boolean
    }) =>
      requestHelpers.post<PageRenameResponse>(
        e(endpoints.wiki.pageRename(data.slug)),
        {
          slug: data.newSlug,
          children: data.children !== false ? 'true' : 'false',
          redirects: data.redirects ? 'true' : 'false',
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki'] })
    },
  })
}

// Tags

export function useTags() {
  const e = useEntityEndpoint()
  return useQuery({
    queryKey: ['wiki', 'tags'],
    queryFn: () => requestHelpers.get<TagsResponse>(e(endpoints.wiki.tags)),
  })
}

export function useTagPages(tag: string) {
  const e = useEntityEndpoint()
  return useQuery({
    queryKey: ['wiki', 'tag', tag],
    queryFn: () =>
      requestHelpers.get<TagPagesResponse>(e(endpoints.wiki.tagPages(tag))),
    enabled: !!tag,
  })
}

// Recent changes

export function useChanges() {
  const e = useEntityEndpoint()
  return useQuery({
    queryKey: ['wiki', 'changes'],
    queryFn: () => requestHelpers.get<ChangesResponse>(e(endpoints.wiki.changes)),
  })
}

export function useAddTag() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: (data: { slug: string; tag: string }) =>
      requestHelpers.post<TagAddResponse>(e(endpoints.wiki.tagAdd(data.slug)), {
        tag: data.tag,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['wiki', 'page', variables.slug],
      })
      queryClient.invalidateQueries({ queryKey: ['wiki', 'tags'] })
      queryClient.invalidateQueries({
        queryKey: ['wiki', 'tag', variables.tag],
      })
    },
  })
}

export function useRemoveTag() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: (data: { slug: string; tag: string }) =>
      requestHelpers.post<TagRemoveResponse>(
        e(endpoints.wiki.tagRemove(data.slug)),
        { tag: data.tag }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['wiki', 'page', variables.slug],
      })
      queryClient.invalidateQueries({ queryKey: ['wiki', 'tags'] })
      queryClient.invalidateQueries({
        queryKey: ['wiki', 'tag', variables.tag],
      })
    },
  })
}

// Search

export function useSearch(query: string) {
  const e = useEntityEndpoint()
  return useQuery({
    queryKey: ['wiki', 'search', query],
    queryFn: () =>
      requestHelpers.get<SearchResponse>(e(endpoints.wiki.search), {
        params: { q: query },
      }),
    enabled: query.length > 0,
  })
}

// Settings

export function useWikiSettings() {
  const e = useEntityEndpoint()
  return useQuery({
    queryKey: ['wiki', 'settings'],
    queryFn: () =>
      requestHelpers.get<SettingsResponse>(e(endpoints.wiki.settings)),
  })
}

export function useSetWikiSetting() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: (data: { name: string; value: string }) =>
      requestHelpers.post<SettingsSetResponse>(e(endpoints.wiki.settingsSet), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'settings'] })
      // Also invalidate info since home page setting affects sidebar URLs
      queryClient.invalidateQueries({ queryKey: ['wiki', 'info'] })
    },
  })
}

// Sync (for subscriber wikis)

interface SyncWikiResponse {
  ok: boolean
  message: string
}

export function useSyncWiki() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: () =>
      requestHelpers.post<SyncWikiResponse>(e(endpoints.wiki.sync), {}),
    onSuccess: () => {
      // Invalidate all wiki data since sync updates everything
      queryClient.invalidateQueries({ queryKey: ['wiki'] })
    },
  })
}

interface DeleteWikiResponse {
  ok: boolean
  deleted: string
}

export function useDeleteWiki() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: () =>
      requestHelpers.post<DeleteWikiResponse>(e(endpoints.wiki.delete), {}),
    onSuccess: async () => {
      // Fetch fresh data from class-level endpoint and update cache
      const freshData = await wikisRequest.get<WikiInfoResponse>(endpoints.wiki.info)
      queryClient.setQueryData(['wiki', 'info'], freshData)
    },
  })
}

// Redirects

export function useRedirects() {
  const e = useEntityEndpoint()
  return useQuery({
    queryKey: ['wiki', 'redirects'],
    queryFn: () =>
      requestHelpers.get<RedirectsResponse>(e(endpoints.wiki.redirects)),
  })
}

export function useSetRedirect() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: (data: { source: string; target: string }) =>
      requestHelpers.post<RedirectSetResponse>(e(endpoints.wiki.redirectSet), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'redirects'] })
    },
  })
}

export function useDeleteRedirect() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: (source: string) =>
      requestHelpers.post<RedirectDeleteResponse>(e(endpoints.wiki.redirectDelete), { source }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'redirects'] })
    },
  })
}

// Comments

export function usePageComments(slug: string) {
  const e = useEntityEndpoint()
  return useQuery({
    queryKey: ['wiki', 'comments', slug],
    queryFn: () =>
      requestHelpers.get<CommentsResponse>(e(endpoints.wiki.pageComments(slug))),
    enabled: !!slug,
  })
}

export function useCreateComment() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: (data: { slug: string; body: string; parent?: string; files?: FileList | File[] }) => {
      const formData = new FormData()
      formData.append('body', data.body)
      if (data.parent) formData.append('parent', data.parent)
      if (data.files) {
        Array.from(data.files).forEach((file) => {
          formData.append('files', file)
        })
      }
      return requestHelpers.post<CommentCreateResponse>(
        e(endpoints.wiki.commentCreate(data.slug)),
        formData
      )
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'comments', variables.slug] })
      // Update comment count in page data
      queryClient.invalidateQueries({ queryKey: ['wiki'], predicate: (query) =>
        query.queryKey.includes('page') && query.queryKey.includes(variables.slug)
      })
    },
  })
}

export function useEditComment() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: (data: { slug: string; id: string; body: string }) =>
      requestHelpers.post<CommentEditResponse>(
        e(endpoints.wiki.commentEdit(data.slug)),
        { id: data.id, body: data.body }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'comments', variables.slug] })
    },
  })
}

export function useDeleteComment() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: (data: { slug: string; id: string }) =>
      requestHelpers.post<CommentDeleteResponse>(
        e(endpoints.wiki.commentDelete(data.slug)),
        { id: data.id }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'comments', variables.slug] })
      queryClient.invalidateQueries({ queryKey: ['wiki'], predicate: (query) =>
        query.queryKey.includes('page') && query.queryKey.includes(variables.slug)
      })
    },
  })
}

// Attachments

export function useAttachments() {
  const e = useEntityEndpoint()
  return useQuery({
    queryKey: ['wiki', 'attachments'],
    queryFn: () =>
      requestHelpers.get<AttachmentsResponse>(e(endpoints.wiki.attachments)),
  })
}

export function useUploadAttachment() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: (files: FileList | File[]) => {
      const formData = new FormData()
      Array.from(files).forEach((file) => {
        formData.append('files', file)
      })
      return requestHelpers.post<AttachmentUploadResponse>(
        e(endpoints.wiki.attachmentUpload),
        formData
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'attachments'] })
    },
  })
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: (id: string) =>
      requestHelpers.post<AttachmentDeleteResponse>(
        e(endpoints.wiki.attachmentDelete),
        { id }
      ),
    onMutate: async (id: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['wiki', 'attachments'] })

      // Snapshot the previous value
      const previous = queryClient.getQueryData<AttachmentsResponse>([
        'wiki',
        'attachments',
      ])

      // Optimistically remove the attachment
      if (previous) {
        queryClient.setQueryData<AttachmentsResponse>(
          ['wiki', 'attachments'],
          {
            attachments: previous.attachments.filter((a) => a.id !== id),
          }
        )
      }

      return { previous }
    },
    onError: (_err, _id, context) => {
      // Roll back on error
      if (context?.previous) {
        queryClient.setQueryData(['wiki', 'attachments'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'attachments'] })
    },
  })
}

// Access Control

export function useAccessRules() {
  const e = useEntityEndpoint()
  return useQuery({
    queryKey: ['wiki', 'access'],
    queryFn: () =>
      requestHelpers.get<AccessListResponse>(e(endpoints.wiki.access)),
  })
}

export function useSetAccess() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: (data: { subject: string; level: string }) =>
      requestHelpers.post<{ success: boolean }>(e(endpoints.wiki.accessSet), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'access'] })
    },
  })
}

export function useRevokeAccess() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: (subject: string) =>
      requestHelpers.post<{ success: boolean }>(e(endpoints.wiki.accessRevoke), { subject }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'access'] })
    },
  })
}

// User/Group search (via People app)

export interface UserSearchResult {
  id: string
  name: string
}

export interface UserSearchResponse {
  results: UserSearchResult[]
}

export function useUserSearch(query: string) {
  return useQuery({
    queryKey: ['users', 'search', query],
    queryFn: async () => {
      const formData = new URLSearchParams()
      formData.append('search', query)
      return wikisRequest.post<UserSearchResponse>(
        endpoints.users.search,
        formData.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      )
    },
    enabled: query.length >= 1,
  })
}

export interface Group {
  id: string
  name: string
  description?: string
}

export interface GroupListResponse {
  groups: Group[]
}

export function useGroups() {
  return useQuery({
    queryKey: ['groups', 'list'],
    queryFn: () => wikisRequest.get<GroupListResponse>(endpoints.groups.list),
  })
}

// Replicas

export interface Replica {
  id: string
  name: string
  subscribed: number
  seen: number
  synced: number
}

interface ReplicasResponse {
  replicas: Replica[]
}

export function useReplicas() {
  const e = useEntityEndpoint()
  return useQuery({
    queryKey: ['wiki', 'replicas'],
    queryFn: () =>
      requestHelpers.get<ReplicasResponse>(e(endpoints.wiki.replicas)),
  })
}

export function useRemoveReplica() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: (replicaId: string) =>
      requestHelpers.post<{ ok: boolean }>(e(endpoints.wiki.replicaRemove), {
        replica: replicaId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'replicas'] })
    },
  })
}

// Create a new wiki

interface CreateWikiResponse {
  id: string
  name: string
  home: string
  fingerprint?: string
}

export function useCreateWiki() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; privacy?: string }) =>
      // Use wikisRequest to ensure class-level action is called even when in entity context
      wikisRequest.post<CreateWikiResponse>(endpoints.wiki.create, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'info'] })
    },
  })
}

// Join a remote wiki

interface JoinWikiResponse {
  id: string
  name: string
  fingerprint: string
  home: string
  message: string
}

export function useJoinWiki() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ target, server }: { target: string; server?: string }) =>
      requestHelpers.post<JoinWikiResponse>(endpoints.wiki.join, { target, server }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'info'] })
    },
  })
}

// Unsubscribe from a wiki (removes local copy)

interface UnsubscribeWikiResponse {
  ok: boolean
  message: string
}

export function useUnsubscribeWiki() {
  const queryClient = useQueryClient()
  const e = useEntityEndpoint()
  return useMutation({
    mutationFn: () =>
      requestHelpers.post<UnsubscribeWikiResponse>(e(endpoints.wiki.unsubscribe), {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'info'] })
    },
  })
}

