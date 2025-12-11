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
  SearchResponse,
  SettingsResponse,
  SettingsSetResponse,
  RedirectsResponse,
  RedirectSetResponse,
  RedirectDeleteResponse,
  AttachmentsResponse,
  AttachmentUploadResponse,
  AttachmentDeleteResponse,
} from '@/types/wiki'
import endpoints from '@/api/endpoints'
import { requestHelpers } from '@/lib/request'

// Wiki info

interface WikiInfoResponse {
  entity: boolean
  wiki?: { id: string; name: string; home: string }
  wikis?: Array<{ id: string; name: string; home: string }>
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', 'attachments'] })
    },
  })
}
