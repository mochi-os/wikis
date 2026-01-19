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
  AttachmentsResponse,
  AttachmentUploadResponse,
  AttachmentDeleteResponse,
  AccessListResponse,
  WikiPermissions,
} from '@/types/wiki'
import endpoints from '@/api/endpoints'
import { requestHelpers } from '@mochi/common'

// Wiki info

export interface WikiInfoResponse {
  entity: boolean
  wiki?: { id: string; name: string; home: string; fingerprint?: string }
  wikis?: Array<{ id: string; name: string; home: string; source?: string; fingerprint?: string }>
  bookmarks?: Array<{ id: string; name: string; added: number; fingerprint?: string }>
  permissions?: WikiPermissions
  fingerprint?: string
}

export function useWikiInfo() {
  return useQuery({
    queryKey: ['wiki', 'info'],
    queryFn: () => requestHelpers.get<WikiInfoResponse>(endpoints.wiki.info),
  })
}

// Page queries

export function usePage(slug: string) {
  return useQuery({
    queryKey: ['wiki', 'page', slug],
    queryFn: () =>
      requestHelpers.get<PageResponse | PageNotFoundResponse>(
        endpoints.wiki.page(slug)
      ),
    enabled: !!slug,
  })
}

export function usePageHistory(slug: string) {
  return useQuery({
    queryKey: ['wiki', 'page', slug, 'history'],
    queryFn: () =>
      requestHelpers.get<PageHistoryResponse>(endpoints.wiki.pageHistory(slug)),
    enabled: !!slug,
  })
}

export function usePageRevision(slug: string, version: number) {
  return useQuery({
    queryKey: ['wiki', 'page', slug, 'revision', version],
    queryFn: () =>
      requestHelpers.get<PageRevisionResponse>(
        endpoints.wiki.pageRevision(slug, version)
      ),
    enabled: !!slug && version > 0,
  })
}

// Page mutations

export function useEditPage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      slug: string
      title: string
      content: string
      comment?: string
    }) =>
      requestHelpers.post<PageEditResponse>(
        endpoints.wiki.pageEdit(data.slug),
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
  return useMutation({
    mutationFn: (data: { slug: string; title: string; content?: string }) =>
      requestHelpers.post<NewPageResponse>(endpoints.wiki.newPage, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki'] })
    },
  })
}

export function useRevertPage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { slug: string; version: number; comment?: string }) =>
      requestHelpers.post<PageRevertResponse>(
        endpoints.wiki.pageRevert(data.slug),
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
  return useMutation({
    mutationFn: (slug: string) =>
      requestHelpers.post<PageDeleteResponse>(endpoints.wiki.pageDelete(slug)),
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
  return useMutation({
    mutationFn: (data: {
      slug: string
      newSlug: string
      children?: boolean
      redirects?: boolean
    }) =>
      requestHelpers.post<PageRenameResponse>(
        endpoints.wiki.pageRename(data.slug),
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
  return useQuery({
    queryKey: ['wiki', 'tags'],
    queryFn: () => requestHelpers.get<TagsResponse>(endpoints.wiki.tags),
  })
}

export function useTagPages(tag: string) {
  return useQuery({
    queryKey: ['wiki', 'tag', tag],
    queryFn: () =>
      requestHelpers.get<TagPagesResponse>(endpoints.wiki.tagPages(tag)),
    enabled: !!tag,
  })
}

// Recent changes

export function useChanges() {
  return useQuery({
    queryKey: ['wiki', 'changes'],
    queryFn: () => requestHelpers.get<ChangesResponse>(endpoints.wiki.changes),
  })
}

export function useAddTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { slug: string; tag: string }) =>
      requestHelpers.post<TagAddResponse>(endpoints.wiki.tagAdd(data.slug), {
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
  return useMutation({
    mutationFn: (data: { slug: string; tag: string }) =>
      requestHelpers.post<TagRemoveResponse>(
        endpoints.wiki.tagRemove(data.slug),
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
  return useQuery({
    queryKey: ['wiki', 'search', query],
    queryFn: () =>
      requestHelpers.get<SearchResponse>(endpoints.wiki.search, {
        params: { q: query },
      }),
    enabled: query.length > 0,
  })
}

// Settings

export function useWikiSettings() {
  return useQuery({
    queryKey: ['wiki', 'settings'],
    queryFn: () =>
      requestHelpers.get<SettingsResponse>(endpoints.wiki.settings),
  })
}

export function useSetWikiSetting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; value: string }) =>
      requestHelpers.post<SettingsSetResponse>(endpoints.wiki.settingsSet, data),
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
  return useMutation({
    mutationFn: () =>
      requestHelpers.post<SyncWikiResponse>(endpoints.wiki.sync, {}),
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
  return useMutation({
    mutationFn: () =>
      requestHelpers.post<DeleteWikiResponse>(endpoints.wiki.delete, {}),
  })
}

// Redirects

export function useRedirects() {
  return useQuery({
    queryKey: ['wiki', 'redirects'],
    queryFn: () =>
      requestHelpers.get<RedirectsResponse>(endpoints.wiki.redirects),
  })
}

export function useSetRedirect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { source: string; target: string }) =>
      requestHelpers.post<RedirectSetResponse>(endpoints.wiki.redirectSet, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'redirects'] })
    },
  })
}

export function useDeleteRedirect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (source: string) =>
      requestHelpers.post<RedirectDeleteResponse>(endpoints.wiki.redirectDelete, { source }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'redirects'] })
    },
  })
}

// Attachments

export function useAttachments() {
  return useQuery({
    queryKey: ['wiki', 'attachments'],
    queryFn: () =>
      requestHelpers.get<AttachmentsResponse>(endpoints.wiki.attachments),
  })
}

export function useUploadAttachment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (files: FileList | File[]) => {
      const formData = new FormData()
      Array.from(files).forEach((file) => {
        formData.append('files', file)
      })
      return requestHelpers.post<AttachmentUploadResponse>(
        endpoints.wiki.attachmentUpload,
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
  return useMutation({
    mutationFn: (id: string) =>
      requestHelpers.post<AttachmentDeleteResponse>(
        endpoints.wiki.attachmentDelete,
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
  return useQuery({
    queryKey: ['wiki', 'access'],
    queryFn: () =>
      requestHelpers.get<AccessListResponse>(endpoints.wiki.access),
  })
}

export function useSetAccess() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { subject: string; level: string }) =>
      requestHelpers.post<{ success: boolean }>(endpoints.wiki.accessSet, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'access'] })
    },
  })
}

export function useRevokeAccess() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (subject: string) =>
      requestHelpers.post<{ success: boolean }>(endpoints.wiki.accessRevoke, { subject }),
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
      return requestHelpers.post<UserSearchResponse>(
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
    queryFn: () => requestHelpers.get<GroupListResponse>(endpoints.groups.list),
  })
}

// Subscribers

export interface Subscriber {
  id: string
  name: string
  subscribed: number
  seen: number
}

interface SubscribersResponse {
  subscribers: Subscriber[]
}

export function useSubscribers() {
  return useQuery({
    queryKey: ['wiki', 'subscribers'],
    queryFn: () =>
      requestHelpers.get<SubscribersResponse>(endpoints.wiki.subscribers),
  })
}

export function useRemoveSubscriber() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (subscriberId: string) =>
      requestHelpers.post<{ ok: boolean }>(endpoints.wiki.subscriberRemove, {
        subscriber: subscriberId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'subscribers'] })
    },
  })
}

// Join a remote wiki

interface JoinWikiResponse {
  id: string
  name: string
  message: string
}

export function useJoinWiki() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (target: string) =>
      requestHelpers.post<JoinWikiResponse>(endpoints.wiki.join, { target }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'info'] })
    },
  })
}

// Bookmark a remote wiki (follow without making a local copy)

interface BookmarkAddResponse {
  id: string
  name: string
  message: string
}

export function useAddBookmark() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (target: string) =>
      requestHelpers.post<BookmarkAddResponse>(endpoints.wiki.bookmarkAdd, { target }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'info'] })
    },
  })
}

interface BookmarkRemoveResponse {
  ok: boolean
  message: string
}

export function useRemoveBookmark() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (target: string) =>
      requestHelpers.post<BookmarkRemoveResponse>(endpoints.wiki.bookmarkRemove, { target }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'info'] })
    },
  })
}
