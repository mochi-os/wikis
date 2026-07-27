// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

const endpoints = {
  // Cross-app endpoints (proxied via wikis backend)
  users: {
    search: '-/users/search',
  },
  groups: {
    list: '-/groups',
  },
  wiki: {
    // Info
    info: '-/info',
    create: '-/create',
    probe: '-/probe',
    join: '-/subscribe',
    directorySearch: '-/directory/search',
    recommendations: '-/recommendations',
    // Pages. The slug goes under a `pages/` container rather than straight into
    // the action slot: baseURL already ends in `/-/`, so a bare slug made a page
    // named after an action resolve to that action - fetching a page called
    // 'delete' hit :wiki/-/delete and destroyed the wiki.
    //
    // Every interpolated value is encoded. The server now restricts slugs to
    // alphanumerics, hyphens and underscores on all write paths, local and
    // remote, so nothing reaching these builders should need it - this is the
    // second line of that defence, and the one place it still earns its keep is
    // tagPages, since tags created before that rule can hold anything.
    page: (slug: string) => `pages/${encodeURIComponent(slug)}`,
    pageEdit: (slug: string) => `pages/${encodeURIComponent(slug)}/edit`,
    pageHistory: (slug: string) => `pages/${encodeURIComponent(slug)}/history`,
    pageRevision: (slug: string, version: number) =>
      `pages/${encodeURIComponent(slug)}/history/${encodeURIComponent(String(version))}`,
    pageRevert: (slug: string) => `pages/${encodeURIComponent(slug)}/revert`,
    pageDelete: (slug: string) => `pages/${encodeURIComponent(slug)}/delete`,
    pageRename: (slug: string) => `pages/${encodeURIComponent(slug)}/rename`,
    newPage: 'page/create',
    search: 'search',
    // Tags
    tagAdd: (slug: string) => `pages/${encodeURIComponent(slug)}/tag/add`,
    tagRemove: (slug: string) => `pages/${encodeURIComponent(slug)}/tag/remove`,
    tags: 'tags',
    tagPages: (tag: string) => `tag/${encodeURIComponent(tag)}`,
    // Recent changes
    changes: 'changes',
    // Redirects
    redirects: 'redirects',
    redirectSet: 'redirect/set',
    redirectDelete: 'redirect/delete',
    // Settings
    settings: 'settings',
    settingsSet: 'settings/set',
    rename: 'rename',
    // Replicas
    replicas: 'replicas',
    replicaRemove: 'replica/remove',
    // Access control
    access: 'access',
    accessSet: 'access/set',
    accessRevoke: 'access/revoke',
    // Delete wiki
    delete: 'delete',
    // Sync
    sync: 'sync',
    subscribe: 'subscribe',
    unsubscribe: 'unsubscribe',
    // Comments
    pageComments: (slug: string) => `pages/${encodeURIComponent(slug)}/comments`,
    commentCreate: (slug: string) => `pages/${encodeURIComponent(slug)}/comment/create`,
    commentEdit: (slug: string) => `pages/${encodeURIComponent(slug)}/comment/edit`,
    commentDelete: (slug: string) => `pages/${encodeURIComponent(slug)}/comment/delete`,
    // Attachments
    attachments: 'attachment/list',
    attachmentUpload: 'attachment/upload',
    attachmentDelete: 'attachment/delete',
  },
} as const

export type Endpoints = typeof endpoints

export default endpoints
