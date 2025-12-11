// Wiki page
export interface WikiPage {
  id: string
  slug: string
  title: string
  content: string
  author: string
  created: number
  updated: number
  version: number
  tags: string[]
}

export interface PageResponse {
  page: WikiPage
}

export interface PageNotFoundResponse {
  error: 'not_found'
  page: string
}

export interface PageEditResponse {
  id: string
  slug: string
  version: number
  created: boolean
}

export interface NewPageResponse {
  id: string
  slug: string
}

// Revisions
export interface Revision {
  id: string
  title: string
  author: string
  created: number
  version: number
  comment: string
}

export interface RevisionDetail extends Revision {
  content: string
}

export interface PageHistoryResponse {
  page: string
  revisions: Revision[]
}

export interface PageRevisionResponse {
  page: string
  revision: RevisionDetail
  current_version: number
}

export interface PageRevertResponse {
  slug: string
  version: number
  reverted_from: number
}

export interface PageDeleteResponse {
  ok: boolean
  slug: string
}

// Tags
export interface Tag {
  tag: string
  count: number
}

export interface TagsResponse {
  tags: Tag[]
}

export interface TagPage {
  page: string
  title: string
  updated: number
}

export interface TagPagesResponse {
  tag: string
  pages: TagPage[]
}

export interface TagAddResponse {
  ok: boolean
  added: boolean
}

export interface TagRemoveResponse {
  ok: boolean
}

// Redirects
export interface Redirect {
  source: string
  target: string
  created: number
}

export interface RedirectsResponse {
  redirects: Redirect[]
}

export interface RedirectSetResponse {
  ok: boolean
}

export interface RedirectDeleteResponse {
  ok: boolean
}

// Search
export interface SearchResult {
  page: string
  title: string
  excerpt: string
  updated: number
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
}

// Settings
export interface WikiSettings {
  home: string
  [key: string]: string
}

export interface SettingsResponse {
  settings: WikiSettings
}

export interface SettingsSetResponse {
  ok: boolean
}

// Sync
export interface SyncResponse {
  ok: boolean
  message: string
}

export interface SubscribeResponse {
  ok: boolean
  message: string
}

// Attachments
export interface Attachment {
  id: string
  name: string
  size: number
  type: string
  created: number
}

export interface AttachmentsResponse {
  attachments: Attachment[]
}

export interface AttachmentUploadResponse {
  attachments: Attachment[]
}

export interface AttachmentDeleteResponse {
  ok: boolean
}
