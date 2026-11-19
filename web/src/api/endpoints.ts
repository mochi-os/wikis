// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { path } from '@mochi/web'

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
    // Pages live under a `pages/` container: baseURL ends in `/-/`, so a bare
    // slug named after an action (e.g. 'delete') would resolve to that action.
    // Values go in through path as a second line of defence; the server
    // restricts slugs on every write path, but tags created before that rule
    // can hold anything.
    page: (slug: string) => path`pages/${slug}`,
    pageEdit: (slug: string) => path`pages/${slug}/edit`,
    pageHistory: (slug: string) => path`pages/${slug}/history`,
    pageRevision: (slug: string, version: number) =>
      path`pages/${slug}/history/${version}`,
    pageRevert: (slug: string) => path`pages/${slug}/revert`,
    diffPreference: 'diff/preference',
    diffPreferenceSet: 'diff/preference/set',
    pageDelete: (slug: string) => path`pages/${slug}/delete`,
    pageRename: (slug: string) => path`pages/${slug}/rename`,
    newPage: 'page/create',
    search: 'search',
    // Tags
    tagAdd: (slug: string) => path`pages/${slug}/tag/add`,
    tagRemove: (slug: string) => path`pages/${slug}/tag/remove`,
    tags: 'tags',
    tagPages: (tag: string) => path`tag/${tag}`,
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
    // Where the wiki publishes on other networks
    publish: 'publish',
    publishSet: 'publish/set',
    publishForget: 'publish/forget',
    // Delete wiki
    delete: 'delete',
    // Sync
    sync: 'sync',
    unsubscribe: 'unsubscribe',
    share: (wiki: string) => path`${wiki}/-/share`,
    // Comments
    pageComments: (slug: string) => path`pages/${slug}/comments`,
    commentCreate: (slug: string) => path`pages/${slug}/comment/create`,
    commentEdit: (slug: string) => path`pages/${slug}/comment/edit`,
    commentDelete: (slug: string) => path`pages/${slug}/comment/delete`,
    // Attachments
    attachments: 'attachment/list',
    attachmentUpload: 'attachment/upload',
    attachmentUpdate: 'attachment/update',
    attachmentDelete: 'attachment/delete',
  },
} as const

export default endpoints
