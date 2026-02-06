// Permissions
export interface WikiPermissions {
  view: boolean
  edit: boolean
  delete: boolean
  manage: boolean
}

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
  missing_links?: string[]
  comment_count?: number
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
  name: string
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

// Recent changes
export interface Change {
  id: string
  slug: string
  title: string
  author: string
  name: string
  created: number
  version: number
  comment: string
}

export interface ChangesResponse {
  changes: Change[]
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

// Comments
export interface WikiComment {
  id: string
  wiki: string
  page: string
  parent: string
  author: string
  name: string
  body: string
  body_markdown: string
  created: number
  edited: number
  children: WikiComment[]
  attachments: Attachment[]
}

export interface CommentsResponse {
  comments: WikiComment[]
  count: number
}

export interface CommentCreateResponse {
  id: string
  wiki: string
  page: string
  parent: string
  author: string
  name: string
  body: string
  created: number
}

export interface CommentEditResponse {
  id: string
  wiki: string
  page: string
  body: string
  edited: number
}

export interface CommentDeleteResponse {
  ok: boolean
}

// Access Control
export interface AccessRule {
  id?: number
  subject: string
  operation: string
  grant: number
  name?: string  // Resolved name for display
  isOwner?: boolean  // True if this rule is for the resource owner
}

export interface AccessListResponse {
  rules: AccessRule[]
}
